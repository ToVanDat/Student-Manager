'use strict';

const sharp = require('sharp');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_INPUT_PIXELS = 16_000_000;
const MAX_SIDE = 1280;
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);

function inputError(message) {
    const error = new Error(message);
    error.code = 'FACE_IMAGE_INVALID';
    return error;
}

// Decode untrusted upload bytes into a bounded, orientation-corrected RGB buffer.
// This does not detect a face or align landmarks; only the trusted server pipeline
// may pass the resulting pixels into the landmark/crop stage.
async function decodeFaceImage(input) {
    if (!Buffer.isBuffer(input) || input.length === 0 || input.length > MAX_IMAGE_BYTES) {
        throw inputError('Ảnh Face Login phải là Buffer hợp lệ, tối đa 5 MB');
    }

    let metadata;
    try {
        metadata = await sharp(input, {
            failOn: 'error',
            limitInputPixels: MAX_INPUT_PIXELS,
            animated: false,
            sequentialRead: true
        }).metadata();
    } catch {
        throw inputError('Không thể giải mã ảnh Face Login');
    }

    if (!ALLOWED_FORMATS.has(metadata.format)) {
        throw inputError('Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP');
    }
    if (!metadata.width || !metadata.height ||
        metadata.width < 160 || metadata.height < 160 ||
        metadata.width * metadata.height > MAX_INPUT_PIXELS ||
        (metadata.pages && metadata.pages > 1)) {
        throw inputError('Kích thước ảnh Face Login không hợp lệ');
    }

    try {
        const result = await sharp(input, {
            failOn: 'error',
            limitInputPixels: MAX_INPUT_PIXELS,
            animated: false,
            sequentialRead: true
        })
            .rotate()
            .resize({
                width: MAX_SIDE,
                height: MAX_SIDE,
                fit: 'inside',
                withoutEnlargement: true
            })
            .toColourspace('srgb')
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        if (result.info.channels !== 3 || !result.data.length ||
            result.data.length !== result.info.width * result.info.height * 3) {
            throw inputError('Ảnh Face Login sau giải mã không hợp lệ');
        }
        return {
            data: result.data,
            width: result.info.width,
            height: result.info.height,
            channels: 3,
            colorSpace: 'RGB'
        };
    } catch (error) {
        if (error?.code === 'FACE_IMAGE_INVALID') throw error;
        throw inputError('Không thể chuẩn hóa ảnh Face Login');
    }
}

module.exports = { decodeFaceImage, MAX_IMAGE_BYTES, MAX_INPUT_PIXELS, MAX_SIDE };
