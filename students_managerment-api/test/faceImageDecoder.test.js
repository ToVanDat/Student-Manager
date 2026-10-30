'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { decodeFaceImage, MAX_IMAGE_BYTES } = require('../service/faceImageDecoder.js');

test('image decoder rejects non-buffer input', async () => {
  await assert.rejects(() => decodeFaceImage('not-an-image'), error => error.code === 'FACE_IMAGE_INVALID');
});

test('image decoder rejects empty and oversized input before decoding', async () => {
  await assert.rejects(() => decodeFaceImage(Buffer.alloc(0)), error => error.code === 'FACE_IMAGE_INVALID');
  await assert.rejects(() => decodeFaceImage(Buffer.alloc(MAX_IMAGE_BYTES + 1)), error => error.code === 'FACE_IMAGE_INVALID');
});
