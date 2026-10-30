'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { inferFaceImage } = require('../service/faceInferenceService.js');

async function main() {
    const imagePath = process.argv[2];
    if (!imagePath) {
        console.error('Usage: npm run face:smoke -- <path-to-consented-test-image.jpg>');
        process.exitCode = 2;
        return;
    }

    const resolvedPath = path.resolve(imagePath);
    if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
        throw new Error('Test image does not exist: ' + resolvedPath);
    }

    const image = fs.readFileSync(resolvedPath);
    const result = await inferFaceImage(image);
    const requiredSignals = ['eyeBlinkLeft', 'eyeBlinkRight', 'mouthSmileLeft', 'mouthSmileRight', 'jawOpen'];
    if (!Array.isArray(result.embedding) || result.embedding.length !== 128 ||
        !result.pad || !Number.isFinite(result.pad.score) ||
        !Number.isFinite(result.pad.bonaFideProbability) || !Number.isFinite(result.pad.attackProbability) ||
        !requiredSignals.every(key => Number.isFinite(result.liveness?.[key]))) {
        throw new Error('Face inference output did not satisfy the expected contract');
    }

    console.log(JSON.stringify({
        status: 'INFERENCE_OK',
        model: result.model,
        embeddingDimensions: result.embedding.length,
        pad: {
            bonaFideProbability: result.pad.bonaFideProbability,
            attackProbability: result.pad.attackProbability,
            classProbabilities: result.pad.classProbabilities,
            score: result.pad.score
        },
        livenessSignalsPresent: requiredSignals.length,
        note: 'Single-image smoke test only. This does not calibrate thresholds or validate PAD/recognition accuracy.'
    }, null, 2));
}

main().catch(error => {
    console.error('[Face inference smoke] FAILED:', error.message);
    process.exitCode = 1;
});
