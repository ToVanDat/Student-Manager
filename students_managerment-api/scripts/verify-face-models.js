'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const modelDir = path.resolve(
    process.env.FACE_MODEL_DIR || path.join(__dirname, '..', 'storage', 'face-models')
);

const expected = {
    'mobile_facenet.onnx': '3ac0b9597efd5dc49c5397e5c21269f98cceb42e7193fcc1afbb0fa992c88e4e',
    'mobile_facenet.data': '5164ee5cdd52328da0b1959913e23fd1866b1696b690fc4ad0bbc5cd32ae319c',
    'metadata.json': '2639a8261232328665a2a6204abc8e41805730f323feda1a1c147006685fe92e',
    'minifasnet-v2.onnx': 'd7b3cd9ba8a7ceb13baa8c4720902e27ca3112eff52f926c08804af6b6eecc7b'
};

function resolveArtifactPath(file) {
    const subdirectory = file.startsWith('mobile_facenet') || file === 'metadata.json' ? 'recognition' : 'anti-spoofing';
    const candidates = [
        path.join(modelDir, subdirectory, file),
        path.join(modelDir, 'face-models', subdirectory, file),
        path.join(modelDir, file)
    ];
    return candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || candidates[0];
}

function sha256(filePath) {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function fail(message) {
    console.error('[Face models] NOT READY:', message);
    process.exitCode = 1;
}

if (!fs.existsSync(modelDir) || !fs.statSync(modelDir).isDirectory()) {
    fail(`Model directory does not exist: ${modelDir}`);
} else {
    let valid = true;
    for (const [file, expectedHash] of Object.entries(expected)) {
        const filePath = resolveArtifactPath(file);
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
            console.error(`[Face models] MISSING: ${file}`);
            valid = false;
            continue;
        }
        const actualHash = sha256(filePath);
        if (actualHash !== expectedHash) {
            console.error(`[Face models] HASH MISMATCH: ${file}`);
            valid = false;
            continue;
        }
        console.log(`[Face models] OK: ${file} (${fs.statSync(filePath).size} bytes)`);
    }

    // The MobileFaceNet ONNX graph references external initializer data.
    // Keep the .data sidecar beside the graph; do not rename either file.
    if (valid) {
        console.log('[Face models] Integrity checks passed. This does not validate inference accuracy or PAD.');
    } else {
        process.exitCode = 1;
    }
}
