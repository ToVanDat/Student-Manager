'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  REFERENCE_POINTS, estimateSimilarityTransform, alignRgbFace, cropPadRgb, toNchwFloat, prepareFaceTensors
} = require('../service/faceAlignment.js');

test('five-point similarity transform maps detected landmarks to canonical coordinates', () => {
  const source = REFERENCE_POINTS.map(([x, y]) => [x * 1.5 + 20, y * 1.5 - 10]);
  const transform = estimateSimilarityTransform(source);
  const mapped = source.map(([x, y]) => [
    transform.a * x - transform.b * y + transform.tx,
    transform.b * x + transform.a * y + transform.ty
  ]);
  mapped.forEach((point, index) => {
    assert.ok(Math.abs(point[0] - REFERENCE_POINTS[index][0]) < 1e-5);
    assert.ok(Math.abs(point[1] - REFERENCE_POINTS[index][1]) < 1e-5);
  });
});

test('similarity transform rejects degenerate landmarks', () => {
  assert.throws(() => estimateSimilarityTransform(Array(5).fill([1, 1])), /degenerate/);
});

test('alignment creates a 112x112 RGB crop', () => {
  const width = 256, height = 256;
  const rgb = Buffer.alloc(width * height * 3, 127);
  const source = [[80, 80], [176, 82], [128, 135], [92, 190], [164, 188]];
  const aligned = alignRgbFace(rgb, width, height, source);
  assert.equal(aligned.length, 112 * 112 * 3);
});

test('PAD crop follows upstream bounded 2.7x bbox expansion and produces 80x80', () => {
  const rgb = Buffer.alloc(200 * 200 * 3, 200);
  const crop = cropPadRgb(rgb, 200, 200, { x: 70, y: 60, width: 60, height: 80 });
  assert.equal(crop.length, 80 * 80 * 3);
});

test('NCHW conversion applies BGR channel order and [0,1] scaling', () => {
  const rgb = Buffer.from([255, 128, 0]);
  const tensor = toNchwFloat(rgb, 1, 1, [2, 1, 0]);
  assert.equal(tensor[0], 0);
  assert.ok(Math.abs(tensor[1] - 128 / 255) < 1e-6);
  assert.equal(tensor[2], 1);
});

test('preprocessing scales trusted landmarks to the decoded image dimensions', () => {
  const width = 256, height = 256;
  const rgb = Buffer.alloc(width * height * 3, 100);
  const sourceFive = [[80, 80], [176, 82], [128, 135], [92, 190], [164, 188]];
  const scaled = {
    width: 128, height: 128,
    five: sourceFive.map(([x, y]) => [x / 2, y / 2]),
    bbox: { x: 45, y: 35, width: 38, height: 48 }
  };
  const tensors = prepareFaceTensors(rgb, width, height, scaled);
  assert.equal(tensors.rgb112.length, 3 * 112 * 112);
  assert.equal(tensors.bgr80.length, 3 * 80 * 80);
});
