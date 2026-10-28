'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { l2Normalize, classProbabilities, assertPixels, EXPECTED_HASHES, PAD_MODEL_CONTRACT } = require('../service/faceInferenceService.js');

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

test('MiniFASNet logits always pass through stable softmax', () => {
  const probabilities = classProbabilities([1000, 999, -1000]);
  assert.ok(Math.abs(probabilities.reduce((a, b) => a + b, 0) - 1) < 1e-12);
  assert.ok(probabilities[0] > probabilities[1]);
});

test('MiniFASNet output class order is pinned to upstream bona-fide index 1', () => {
  assert.deepEqual(PAD_MODEL_CONTRACT.output.classOrder,
    ['attack_class_0', 'bona_fide', 'attack_class_2']);
  assert.equal(PAD_MODEL_CONTRACT.output.bonaFideIndex, 1);
  const probabilities = classProbabilities([0, 8, 0]);
  assert.ok(probabilities[1] > 0.99);
});

test('MiniFASNet rejects non-finite logits and wrong class count', () => {
  assert.throws(() => classProbabilities([0, Number.NaN, 1]), /3 logits hữu hạn/);
});

test('MiniFASNet rejects invalid class count', () => {
  assert.throws(() => classProbabilities([0, 1]), /3 giá trị/);
});

test('pixel tensors enforce exact shape and range', () => {
  assert.doesNotThrow(() => assertPixels(new Float32Array(3 * 112 * 112), 3 * 112 * 112, 'rgb112'));
  const invalid = new Float32Array(3 * 80 * 80); invalid[0] = 1.1;
  assert.throws(() => assertPixels(invalid, invalid.length, 'bgr80'));
});

test('manifest pins the exact supplied MobileFaceNet and MiniFASNet artifacts', () => {
  assert.deepEqual(EXPECTED_HASHES, {
    'mobile_facenet.onnx': '3ac0b9597efd5dc49c5397e5c21269f98cceb42e7193fcc1afbb0fa992c88e4e',
    'mobile_facenet.data': '5164ee5cdd52328da0b1959913e23fd1866b1696b690fc4ad0bbc5cd32ae319c',
    'metadata.json': '2639a8261232328665a2a6204abc8e41805730f323feda1a1c147006685fe92e',
    'minifasnet-v2.onnx': 'd7b3cd9ba8a7ceb13baa8c4720902e27ca3112eff52f926c08804af6b6eecc7b'
  });
});
