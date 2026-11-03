'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    isPrivateHttpHost,
    validateLandmarkServiceUrl
} = require('../service/faceLandmarkClient.js');

const production = { NODE_ENV: 'production' };

test('allows loopback HTTP for a colocated landmark process', () => {
    assert.equal(validateLandmarkServiceUrl('http://127.0.0.1:3010', production).hostname, '127.0.0.1');
    assert.equal(validateLandmarkServiceUrl('http://localhost:3010', production).hostname, 'localhost');
    assert.equal(validateLandmarkServiceUrl('http://[::1]:3010', production).protocol, 'http:');
});

test('allows only explicit Docker/private-network HTTP targets when opted in', () => {
    const env = { ...production, FACE_LANDMARK_SERVICE_ALLOW_PRIVATE_HTTP: 'true' };
    assert.equal(validateLandmarkServiceUrl('http://face-landmark:3010', env).hostname, 'face-landmark');
    assert.equal(validateLandmarkServiceUrl('http://10.10.0.8:3010', env).hostname, '10.10.0.8');
    assert.equal(validateLandmarkServiceUrl('http://172.20.0.4:3010', env).hostname, '172.20.0.4');
    assert.equal(validateLandmarkServiceUrl('http://192.168.1.20:3010', env).hostname, '192.168.1.20');
    assert.equal(validateLandmarkServiceUrl('http://[fd12::5]:3010', env).protocol, 'http:');
});

test('rejects public HTTP destinations even when private HTTP is enabled', () => {
    const env = { ...production, FACE_LANDMARK_SERVICE_ALLOW_PRIVATE_HTTP: 'true' };
    assert.throws(() => validateLandmarkServiceUrl('http://8.8.8.8:3010', env), error => error.code === 'FACE_AUTH_CONFIG_INVALID');
    assert.throws(() => validateLandmarkServiceUrl('http://public.example.com:3010', env), error => error.code === 'FACE_AUTH_CONFIG_INVALID');
    assert.throws(() => validateLandmarkServiceUrl('http://10.10.0.8:3010', production), error => error.code === 'FACE_AUTH_CONFIG_INVALID');
});

test('allows HTTPS endpoints and rejects unsupported protocols', () => {
    assert.equal(validateLandmarkServiceUrl('https://landmark.example.com', production).protocol, 'https:');
    assert.throws(() => validateLandmarkServiceUrl('ftp://landmark.example.com', production), error => error.code === 'FACE_AUTH_CONFIG_INVALID');
});

test('classifies only private address ranges and the configured Compose service name', () => {
    assert.equal(isPrivateHttpHost('10.0.0.1'), true);
    assert.equal(isPrivateHttpHost('172.31.255.254'), true);
    assert.equal(isPrivateHttpHost('192.168.0.1'), true);
    assert.equal(isPrivateHttpHost('172.32.0.1'), false);
    assert.equal(isPrivateHttpHost('100.64.0.1'), false);
    assert.equal(isPrivateHttpHost('face-landmark'), true);
    assert.equal(isPrivateHttpHost('8.8.8.8'), false);
});
