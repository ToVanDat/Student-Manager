'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { l2Normalize, classProbabilities, assertPixels, EXPECTED_HASHES } = require('../service/faceInferenceService.js');

test('MobileFaceNet embedding is L2-normalized', () => {
  const embedding = l2Normalize(Float32Array.from({ length: 128 }, (_, i) => i + 1));
  const norm = Math.sqrt(embedding.reduce((sum, value) => sum + value * value, 0));
  assert.ok(Math.abs(norm - 1) < 1e-5);
});

test('MobileFaceNet rejects wrong dimensions and non-finite outputs', () => {
  assert.throws(() => l2Normalize([1, 2, 3]), /128/);
  const invalid = new Float32Array(128); invalid[12] = Number.NaN;
  assert.throws(() => l2Normalize(invalid), /hữu hạn/);
});

test('MiniFASNet logits become stable probabilities', () => {
  const probabilities = classProbabilities([1000, 999, -1000]);
  assert.ok(Math.abs(probabilities.reduce((a, b) => a + b, 0) - 1) < 1e-12);
  assert.ok(probabilities[0] > probabilities[1]);
});

test('MiniFASNet rejects invalid class count', () => {
  assert.throws(() => classProbabilities([0, 1]), /3 values/);
});

test('pixel tensors enforce exact shape and range', () => {
  assert.doesNotThrow(() => assertPixels(new Float32Array(3 * 112 * 112), 3 * 112 * 112, 'rgb112'));
  const invalid = new Float32Array(3 * 80 * 80); invalid[0] = 1.1;
  assert.throws(() => assertPixels(invalid, invalid.length, 'bgr80'));
});

test('manifest pins all supplied artifacts', () => {
  for (const hash of Object.values(EXPECTED_HASHES)) assert.equal(hash.length, 64);
});
