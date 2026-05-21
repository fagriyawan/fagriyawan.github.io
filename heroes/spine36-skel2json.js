/**
 * Spine 3.6 Binary (.skel) to JSON converter
 * Converts Spine 3.6.x binary skeleton data to JSON format
 * that can be loaded by pixi-spine's VER37 SkeletonJson parser.
 *
 * Based on the Spine 3.6.39 C# SkeletonBinary source.
 */
(function(global) {
'use strict';


class BinaryReader {
    constructor(buffer) {
        this.data = new Uint8Array(buffer);
        this.view = new DataView(buffer instanceof ArrayBuffer ? buffer : buffer.buffer);
        this.pos = 0;
    }

    readByte() { return this.data[this.pos++]; }

    readSByte() {
        const v = this.data[this.pos++];
        return v > 127 ? v - 256 : v;
    }

    readBoolean() { return this.readByte() !== 0; }

    readFloat() {
        const b3 = this.readByte(), b2 = this.readByte();
        const b1 = this.readByte(), b0 = this.readByte();
        const buf = new ArrayBuffer(4);
        const u8 = new Uint8Array(buf);
        u8[0] = b0; u8[1] = b1; u8[2] = b2; u8[3] = b3;
        return new DataView(buf).getFloat32(0, true);
    }

    readInt() {
        return (this.readByte() << 24) | (this.readByte() << 16) |
               (this.readByte() << 8) | this.readByte();
    }

    readVarint(optimizePositive) {
        let b = this.readByte();
        let result = b & 0x7F;
        if ((b & 0x80) !== 0) {
            b = this.readByte();
            result |= (b & 0x7F) << 7;
            if ((b & 0x80) !== 0) {
                b = this.readByte();
                result |= (b & 0x7F) << 14;
                if ((b & 0x80) !== 0) {
                    b = this.readByte();
                    result |= (b & 0x7F) << 21;
                    if ((b & 0x80) !== 0) {
                        result |= (this.readByte() & 0x7F) << 28;
                    }
                }
            }
        }
        return optimizePositive ? result : ((result >>> 1) ^ -(result & 1));
    }

    readString() {
        let byteCount = this.readVarint(true);
        if (byteCount === 0) return null;
        if (byteCount === 1) return '';
        byteCount--;
        const bytes = this.data.slice(this.pos, this.pos + byteCount);
        this.pos += byteCount;
        return new TextDecoder().decode(bytes);
    }

    readShortArray() {
        const n = this.readVarint(true);
        const arr = [];
        for (let i = 0; i < n; i++)
            arr.push((this.readByte() << 8) | this.readByte());
        return arr;
    }

    readFloatArray(n, scale) {
        const arr = [];
        for (let i = 0; i < n; i++) arr.push(this.readFloat() * scale);
        return arr;
    }
}


const TRANSFORM_MODES = ['normal', 'onlyTranslation', 'noRotationOrReflection', 'noScale', 'noScaleOrReflection'];
const BLEND_MODES = ['normal', 'additive', 'multiply', 'screen'];
const POSITION_MODES = ['fixed', 'percent'];
const SPACING_MODES = ['length', 'fixed', 'percent'];
const ROTATE_MODES = ['tangent', 'chain', 'chainScale'];
const ATTACHMENT_TYPES = ['region', 'boundingbox', 'mesh', 'linkedmesh', 'path', 'point', 'clipping'];

const BONE_ROTATE = 0, BONE_TRANSLATE = 1, BONE_SCALE = 2, BONE_SHEAR = 3;
const SLOT_ATTACHMENT = 0, SLOT_COLOR = 1, SLOT_TWO_COLOR = 2;
const PATH_POSITION = 0, PATH_SPACING = 1, PATH_MIX = 2;
const CURVE_LINEAR = 0, CURVE_STEPPED = 1, CURVE_BEZIER = 2;

function colorToString(intColor) {
    return ((intColor >>> 0)).toString(16).padStart(8, '0');
}


function readVertices(reader, vertexCount) {
    const isWeighted = reader.readBoolean();
    const verticesLength = vertexCount << 1;
    if (!isWeighted) {
        return { vertices: reader.readFloatArray(verticesLength, 1), bones: null };
    }
    const weights = [];
    const bones = [];
    for (let i = 0; i < vertexCount; i++) {
        const boneCount = reader.readVarint(true);
        bones.push(boneCount);
        for (let ii = 0; ii < boneCount; ii++) {
            bones.push(reader.readVarint(true));
            weights.push(reader.readFloat());
            weights.push(reader.readFloat());
            weights.push(reader.readFloat());
        }
    }
    return { vertices: weights, bones: bones };
}

function readCurve(reader) {
    const type = reader.readByte();
    if (type === CURVE_STEPPED) return 'stepped';
    if (type === CURVE_BEZIER) {
        return [reader.readFloat(), reader.readFloat(), reader.readFloat(), reader.readFloat()];
    }
    return null; // linear
}


function readAttachment(reader, skinName, slotIndex, attachmentName, nonessential, skeletonData) {
    let name = reader.readString();
    if (name === null) name = attachmentName;
    const typeIdx = reader.readByte();

    switch (typeIdx) {
    case 0: { // Region
        const path = reader.readString() || name;
        const rotation = reader.readFloat();
        const x = reader.readFloat();
        const y = reader.readFloat();
        const scaleX = reader.readFloat();
        const scaleY = reader.readFloat();
        const width = reader.readFloat();
        const height = reader.readFloat();
        const color = colorToString(reader.readInt());
        return { name, type: 'region', path, rotation, x, y, scaleX, scaleY, width, height, color };
    }
    case 1: { // BoundingBox
        const vertexCount = reader.readVarint(true);
        const v = readVertices(reader, vertexCount);
        if (nonessential) reader.readInt();
        const result = { name, type: 'boundingbox', vertexCount, vertices: v.vertices };
        if (v.bones) result.bones = v.bones;
        return result;
    }
    case 2: { // Mesh
        const path = reader.readString() || name;
        const color = colorToString(reader.readInt());
        const vertexCount = reader.readVarint(true);
        const uvs = reader.readFloatArray(vertexCount << 1, 1);
        const triangles = reader.readShortArray();
        const v = readVertices(reader, vertexCount);
        const hull = reader.readVarint(true);
        let edges = null, width = 0, height = 0;
        if (nonessential) {
            edges = reader.readShortArray();
            width = reader.readFloat();
            height = reader.readFloat();
        }
        const result = { name, type: 'mesh', path, color, uvs, triangles, vertices: v.vertices, hull };
        if (v.bones) result.bones = v.bones;
        if (edges) result.edges = edges;
        if (nonessential) { result.width = width; result.height = height; }
        return result;
    }
    case 3: { // LinkedMesh
        const path = reader.readString() || name;
        const color = colorToString(reader.readInt());
        const skin = reader.readString();
        const parent = reader.readString();
        const inheritDeform = reader.readBoolean();
        let width = 0, height = 0;
        if (nonessential) { width = reader.readFloat(); height = reader.readFloat(); }
        const result = { name, type: 'linkedmesh', path, color, skin, parent, deform: inheritDeform };
        if (nonessential) { result.width = width; result.height = height; }
        return result;
    }
    case 4: { // Path
        const closed = reader.readBoolean();
        const constantSpeed = reader.readBoolean();
        const vertexCount = reader.readVarint(true);
        const v = readVertices(reader, vertexCount);
        const lengths = [];
        for (let i = 0, n = vertexCount / 3; i < n; i++) lengths.push(reader.readFloat());
        if (nonessential) reader.readInt();
        const result = { name, type: 'path', closed, constantSpeed, vertexCount, vertices: v.vertices, lengths };
        if (v.bones) result.bones = v.bones;
        return result;
    }
    case 5: { // Point
        const rotation = reader.readFloat();
        const x = reader.readFloat();
        const y = reader.readFloat();
        if (nonessential) reader.readInt();
        return { name, type: 'point', rotation, x, y };
    }
    case 6: { // Clipping
        const endSlotIndex = reader.readVarint(true);
        const vertexCount = reader.readVarint(true);
        const v = readVertices(reader, vertexCount);
        if (nonessential) reader.readInt();
        const result = { name, type: 'clipping', end: skeletonData.slots[endSlotIndex].name, vertexCount, vertices: v.vertices };
        if (v.bones) result.bones = v.bones;
        return result;
    }
    }
    return null;
}


function readSkin(reader, skeletonData, skinName, nonessential) {
    const slotCount = reader.readVarint(true);
    if (slotCount === 0) return null;
    const skin = {};
    for (let i = 0; i < slotCount; i++) {
        const slotIndex = reader.readVarint(true);
        const slotName = skeletonData.slots[slotIndex].name;
        const attachments = {};
        const attCount = reader.readVarint(true);
        for (let ii = 0; ii < attCount; ii++) {
            const attName = reader.readString();
            const att = readAttachment(reader, skinName, slotIndex, attName, nonessential, skeletonData);
            if (att) attachments[attName] = att;
        }
        skin[slotName] = attachments;
    }
    return skin;
}


function readAnimation(reader, name, skeletonData) {
    const anim = {};
    const scale = 1;

    // Slot timelines
    const slotTimelineCount = reader.readVarint(true);
    if (slotTimelineCount > 0) {
        anim.slots = {};
        for (let i = 0; i < slotTimelineCount; i++) {
            const slotIndex = reader.readVarint(true);
            const slotName = skeletonData.slots[slotIndex].name;
            const slotTimelines = {};
            const tlCount = reader.readVarint(true);
            for (let ii = 0; ii < tlCount; ii++) {
                const type = reader.readByte();
                const frameCount = reader.readVarint(true);
                switch (type) {
                case SLOT_ATTACHMENT: {
                    const frames = [];
                    for (let f = 0; f < frameCount; f++)
                        frames.push({ time: reader.readFloat(), name: reader.readString() });
                    slotTimelines.attachment = frames;
                    break;
                }
                case SLOT_COLOR: {
                    const frames = [];
                    for (let f = 0; f < frameCount; f++) {
                        const frame = { time: reader.readFloat(), color: colorToString(reader.readInt()) };
                        if (f < frameCount - 1) {
                            const c = readCurve(reader);
                            if (c) frame.curve = c;
                        }
                        frames.push(frame);
                    }
                    slotTimelines.color = frames;
                    break;
                }
                case SLOT_TWO_COLOR: {
                    const frames = [];
                    for (let f = 0; f < frameCount; f++) {
                        const frame = { time: reader.readFloat() };
                        frame.light = colorToString(reader.readInt());
                        frame.dark = colorToString(reader.readInt()).substring(2); // rgb only
                        if (f < frameCount - 1) {
                            const c = readCurve(reader);
                            if (c) frame.curve = c;
                        }
                        frames.push(frame);
                    }
                    slotTimelines.twoColor = frames;
                    break;
                }
                }
            }
            anim.slots[slotName] = slotTimelines;
        }
    }

    // Bone timelines
    const boneTimelineCount = reader.readVarint(true);
    if (boneTimelineCount > 0) {
        anim.bones = {};
        for (let i = 0; i < boneTimelineCount; i++) {
            const boneIndex = reader.readVarint(true);
            const boneName = skeletonData.bones[boneIndex].name;
            const boneTimelines = {};
            const tlCount = reader.readVarint(true);
            for (let ii = 0; ii < tlCount; ii++) {
                const type = reader.readByte();
                const frameCount = reader.readVarint(true);
                switch (type) {
                case BONE_ROTATE: {
                    const frames = [];
                    for (let f = 0; f < frameCount; f++) {
                        const frame = { time: reader.readFloat(), angle: reader.readFloat() };
                        if (f < frameCount - 1) {
                            const c = readCurve(reader);
                            if (c) frame.curve = c;
                        }
                        frames.push(frame);
                    }
                    boneTimelines.rotate = frames;
                    break;
                }
                case BONE_TRANSLATE:
                case BONE_SCALE:
                case BONE_SHEAR: {
                    const frames = [];
                    const tlScale = (type === BONE_TRANSLATE) ? scale : 1;
                    for (let f = 0; f < frameCount; f++) {
                        const frame = { time: reader.readFloat(), x: reader.readFloat() * tlScale, y: reader.readFloat() * tlScale };
                        if (f < frameCount - 1) {
                            const c = readCurve(reader);
                            if (c) frame.curve = c;
                        }
                        frames.push(frame);
                    }
                    const key = type === BONE_TRANSLATE ? 'translate' : type === BONE_SCALE ? 'scale' : 'shear';
                    boneTimelines[key] = frames;
                    break;
                }
                }
            }
            anim.bones[boneName] = boneTimelines;
        }
    }


    // IK timelines
    const ikCount = reader.readVarint(true);
    if (ikCount > 0) {
        anim.ik = {};
        for (let i = 0; i < ikCount; i++) {
            const ikIndex = reader.readVarint(true);
            const ikName = skeletonData.ik[ikIndex].name;
            const frameCount = reader.readVarint(true);
            const frames = [];
            for (let f = 0; f < frameCount; f++) {
                const frame = { time: reader.readFloat(), mix: reader.readFloat(), bendPositive: reader.readSByte() > 0 };
                if (f < frameCount - 1) { const c = readCurve(reader); if (c) frame.curve = c; }
                frames.push(frame);
            }
            anim.ik[ikName] = frames;
        }
    }

    // Transform constraint timelines
    const transformCount = reader.readVarint(true);
    if (transformCount > 0) {
        anim.transform = {};
        for (let i = 0; i < transformCount; i++) {
            const tIndex = reader.readVarint(true);
            const tName = skeletonData.transform[tIndex].name;
            const frameCount = reader.readVarint(true);
            const frames = [];
            for (let f = 0; f < frameCount; f++) {
                const frame = {
                    time: reader.readFloat(),
                    rotateMix: reader.readFloat(), translateMix: reader.readFloat(),
                    scaleMix: reader.readFloat(), shearMix: reader.readFloat()
                };
                if (f < frameCount - 1) { const c = readCurve(reader); if (c) frame.curve = c; }
                frames.push(frame);
            }
            anim.transform[tName] = frames;
        }
    }

    // Path constraint timelines
    const pathTlCount = reader.readVarint(true);
    if (pathTlCount > 0) {
        anim.path = {};
        for (let i = 0; i < pathTlCount; i++) {
            const pIndex = reader.readVarint(true);
            const pData = skeletonData.path[pIndex];
            const pName = pData.name;
            const pathTimelines = {};
            const innerCount = reader.readVarint(true);
            for (let ii = 0; ii < innerCount; ii++) {
                const pType = reader.readSByte();
                const frameCount = reader.readVarint(true);
                if (pType === PATH_POSITION || pType === PATH_SPACING) {
                    const frames = [];
                    for (let f = 0; f < frameCount; f++) {
                        const frame = { time: reader.readFloat() };
                        frame[pType === PATH_POSITION ? 'position' : 'spacing'] = reader.readFloat();
                        if (f < frameCount - 1) { const c = readCurve(reader); if (c) frame.curve = c; }
                        frames.push(frame);
                    }
                    pathTimelines[pType === PATH_POSITION ? 'position' : 'spacing'] = frames;
                } else { // PATH_MIX
                    const frames = [];
                    for (let f = 0; f < frameCount; f++) {
                        const frame = { time: reader.readFloat(), rotateMix: reader.readFloat(), translateMix: reader.readFloat() };
                        if (f < frameCount - 1) { const c = readCurve(reader); if (c) frame.curve = c; }
                        frames.push(frame);
                    }
                    pathTimelines.mix = frames;
                }
            }
            anim.path[pName] = pathTimelines;
        }
    }


    // Deform timelines
    const deformCount = reader.readVarint(true);
    if (deformCount > 0) {
        anim.deform = {};
        for (let i = 0; i < deformCount; i++) {
            const skinIndex = reader.readVarint(true);
            const skinName = skinIndex === 0 ? 'default' : skeletonData.skinNames[skinIndex - 1];
            const skinDeform = {};
            const slotDeformCount = reader.readVarint(true);
            for (let ii = 0; ii < slotDeformCount; ii++) {
                const slotIndex = reader.readVarint(true);
                const slotName = skeletonData.slots[slotIndex].name;
                const slotDeform = {};
                const attDeformCount = reader.readVarint(true);
                for (let iii = 0; iii < attDeformCount; iii++) {
                    const attName = reader.readString();
                    const frameCount = reader.readVarint(true);
                    const frames = [];
                    for (let f = 0; f < frameCount; f++) {
                        const time = reader.readFloat();
                        const frame = { time };
                        const end = reader.readVarint(true);
                        if (end !== 0) {
                            const offset = reader.readVarint(true);
                            const verts = [];
                            for (let v = 0; v < end; v++) verts.push(reader.readFloat());
                            frame.offset = offset;
                            frame.vertices = verts;
                        }
                        if (f < frameCount - 1) { const c = readCurve(reader); if (c) frame.curve = c; }
                        frames.push(frame);
                    }
                    slotDeform[attName] = frames;
                }
                skinDeform[slotName] = slotDeform;
            }
            anim.deform[skinName] = skinDeform;
        }
    }

    // Draw order timeline
    const drawOrderCount = reader.readVarint(true);
    if (drawOrderCount > 0) {
        anim.drawOrder = [];
        const slotCount = skeletonData.slots.length;
        for (let i = 0; i < drawOrderCount; i++) {
            const time = reader.readFloat();
            const offsetCount = reader.readVarint(true);
            const offsets = [];
            for (let ii = 0; ii < offsetCount; ii++) {
                const slotIndex = reader.readVarint(true);
                const offset = reader.readVarint(true);
                offsets.push({ slot: skeletonData.slots[slotIndex].name, offset });
            }
            anim.drawOrder.push({ time, offsets });
        }
    }

    // Event timeline
    const eventCount = reader.readVarint(true);
    if (eventCount > 0) {
        anim.events = [];
        for (let i = 0; i < eventCount; i++) {
            const time = reader.readFloat();
            const eventIndex = reader.readVarint(true);
            const eventData = skeletonData.events[eventIndex];
            const evt = { time, name: eventData.name };
            evt.int = reader.readVarint(false);
            evt.float = reader.readFloat();
            const hasString = reader.readBoolean();
            evt.string = hasString ? reader.readString() : eventData.string;
            anim.events.push(evt);
        }
    }

    return { name, data: anim };
}


/**
 * Convert a Spine 3.6 binary (.skel) ArrayBuffer to a JSON object
 * compatible with pixi-spine's SkeletonJson parser.
 */
function spine36SkelToJson(buffer) {
    const reader = new BinaryReader(buffer);
    const json = {};

    // Skeleton header
    const hash = reader.readString();
    const version = reader.readString();
    const width = reader.readFloat();
    const height = reader.readFloat();
    const nonessential = reader.readBoolean();

    json.skeleton = { hash: hash || '', spine: version || '3.6.51', width, height };

    let imagesPath = '';
    if (nonessential) {
        const fps = reader.readFloat();
        imagesPath = reader.readString() || '';
        json.skeleton.fps = fps;
        json.skeleton.images = imagesPath;
    }

    // Internal tracking for index-based lookups
    const skeletonData = { bones: [], slots: [], ik: [], transform: [], path: [], events: [], skinNames: [] };

    // Bones
    json.bones = [];
    const boneCount = reader.readVarint(true);
    for (let i = 0; i < boneCount; i++) {
        const name = reader.readString();
        let parent = null;
        if (i > 0) {
            const parentIndex = reader.readVarint(true);
            parent = skeletonData.bones[parentIndex].name;
        }
        const bone = { name };
        if (parent) bone.parent = parent;
        bone.rotation = reader.readFloat();
        bone.x = reader.readFloat();
        bone.y = reader.readFloat();
        bone.scaleX = reader.readFloat();
        bone.scaleY = reader.readFloat();
        bone.shearX = reader.readFloat();
        bone.shearY = reader.readFloat();
        const length = reader.readFloat();
        if (length !== 0) bone.length = length;
        const transformMode = TRANSFORM_MODES[reader.readVarint(true)];
        if (transformMode !== 'normal') bone.transform = transformMode;
        if (nonessential) {
            const color = colorToString(reader.readInt());
            bone.color = color;
        }
        json.bones.push(bone);
        skeletonData.bones.push({ name });
    }


    // Slots
    json.slots = [];
    const slotCount = reader.readVarint(true);
    for (let i = 0; i < slotCount; i++) {
        const name = reader.readString();
        const boneIndex = reader.readVarint(true);
        const slot = { name, bone: skeletonData.bones[boneIndex].name };
        const color = reader.readInt();
        const colorStr = colorToString(color);
        if (colorStr !== 'ffffffff') slot.color = colorStr;
        const darkColor = reader.readInt();
        if (darkColor !== -1 && darkColor !== 0xFFFFFFFF) {
            slot.dark = colorToString(darkColor).substring(2); // only rgb
        }
        const attachment = reader.readString();
        if (attachment) slot.attachment = attachment;
        const blendMode = BLEND_MODES[reader.readVarint(true)];
        if (blendMode !== 'normal') slot.blend = blendMode;
        json.slots.push(slot);
        skeletonData.slots.push({ name });
    }

    // IK constraints
    json.ik = [];
    const ikCount = reader.readVarint(true);
    for (let i = 0; i < ikCount; i++) {
        const name = reader.readString();
        const order = reader.readVarint(true);
        const boneCount = reader.readVarint(true);
        const bones = [];
        for (let ii = 0; ii < boneCount; ii++) bones.push(skeletonData.bones[reader.readVarint(true)].name);
        const target = skeletonData.bones[reader.readVarint(true)].name;
        const mix = reader.readFloat();
        const bendPositive = reader.readSByte() > 0;
        const ik = { name, order, bones, target, mix };
        if (!bendPositive) ik.bendPositive = false;
        json.ik.push(ik);
        skeletonData.ik.push({ name });
    }

    // Transform constraints
    json.transform = [];
    const transformCount = reader.readVarint(true);
    for (let i = 0; i < transformCount; i++) {
        const name = reader.readString();
        const order = reader.readVarint(true);
        const boneCount = reader.readVarint(true);
        const bones = [];
        for (let ii = 0; ii < boneCount; ii++) bones.push(skeletonData.bones[reader.readVarint(true)].name);
        const target = skeletonData.bones[reader.readVarint(true)].name;
        const local = reader.readBoolean();
        const relative = reader.readBoolean();
        const offsetRotation = reader.readFloat();
        const offsetX = reader.readFloat();
        const offsetY = reader.readFloat();
        const offsetScaleX = reader.readFloat();
        const offsetScaleY = reader.readFloat();
        const offsetShearY = reader.readFloat();
        const rotateMix = reader.readFloat();
        const translateMix = reader.readFloat();
        const scaleMix = reader.readFloat();
        const shearMix = reader.readFloat();
        const t = { name, order, bones, target };
        if (local) t.local = true;
        if (relative) t.relative = true;
        if (offsetRotation) t.rotation = offsetRotation;
        if (offsetX) t.x = offsetX;
        if (offsetY) t.y = offsetY;
        if (offsetScaleX) t.scaleX = offsetScaleX;
        if (offsetScaleY) t.scaleY = offsetScaleY;
        if (offsetShearY) t.shearY = offsetShearY;
        t.rotateMix = rotateMix;
        t.translateMix = translateMix;
        t.scaleMix = scaleMix;
        t.shearMix = shearMix;
        json.transform.push(t);
        skeletonData.transform.push({ name });
    }


    // Path constraints
    json.path = [];
    const pathCount = reader.readVarint(true);
    for (let i = 0; i < pathCount; i++) {
        const name = reader.readString();
        const order = reader.readVarint(true);
        const boneCount = reader.readVarint(true);
        const bones = [];
        for (let ii = 0; ii < boneCount; ii++) bones.push(skeletonData.bones[reader.readVarint(true)].name);
        const target = skeletonData.slots[reader.readVarint(true)].name;
        const positionMode = POSITION_MODES[reader.readVarint(true)];
        const spacingMode = SPACING_MODES[reader.readVarint(true)];
        const rotateMode = ROTATE_MODES[reader.readVarint(true)];
        const offsetRotation = reader.readFloat();
        const position = reader.readFloat();
        const spacing = reader.readFloat();
        const rotateMix = reader.readFloat();
        const translateMix = reader.readFloat();
        const p = { name, order, bones, target, positionMode, spacingMode, rotateMode };
        if (offsetRotation) p.rotation = offsetRotation;
        p.position = position;
        p.spacing = spacing;
        p.rotateMix = rotateMix;
        p.translateMix = translateMix;
        json.path.push(p);
        skeletonData.path.push({ name, positionMode, spacingMode });
    }

    // Skins
    json.skins = {};
    // Default skin
    const defaultSkin = readSkin(reader, skeletonData, 'default', nonessential);
    if (defaultSkin) json.skins['default'] = defaultSkin;
    // Named skins
    const skinCount = reader.readVarint(true);
    for (let i = 0; i < skinCount; i++) {
        const skinName = reader.readString();
        skeletonData.skinNames.push(skinName);
        const skin = readSkin(reader, skeletonData, skinName, nonessential);
        if (skin) json.skins[skinName] = skin;
    }

    // Events
    json.events = {};
    const eventCount = reader.readVarint(true);
    for (let i = 0; i < eventCount; i++) {
        const name = reader.readString();
        const intVal = reader.readVarint(false);
        const floatVal = reader.readFloat();
        const stringVal = reader.readString();
        const evt = {};
        if (intVal !== 0) evt.int = intVal;
        if (floatVal !== 0) evt.float = floatVal;
        if (stringVal) evt.string = stringVal;
        json.events[name] = evt;
        skeletonData.events.push({ name, int: intVal, float: floatVal, string: stringVal || '' });
    }

    // Animations
    json.animations = {};
    const animCount = reader.readVarint(true);
    for (let i = 0; i < animCount; i++) {
        const animName = reader.readString();
        const animResult = readAnimation(reader, animName, skeletonData);
        json.animations[animName] = animResult.data;
    }

    return json;
}

// Export
global.spine36SkelToJson = spine36SkelToJson;

})(typeof window !== 'undefined' ? window : this);
