'use strict';

const { inferAlignedFace } = require('../service/faceInferenceService.js');

async function main() {
    // Synthetic tensors validate ONNX graph loading/execution only. They are not
    // face samples and must never be interpreted as recognition/PAD accuracy.
    const result = await inferAlignedFace({
        rgb112: new Float32Array(3 * 112 * 112),
        bgr80: new Float32Array(3 * 80 * 80)
    });

    const norm = Math.sqrt(result.embedding.reduce((sum, value) => sum + value * value, 0));
    const probabilities = [
        result.pad.liveProbability,
        result.pad.printAttackProbability,
        result.pad.replayAttackProbability
    ];
    if (result.embedding.length !== 128 ||
        !Number.isFinite(norm) || Math.abs(norm - 1) > 1e-4 ||
        probabilities.some(value => !Number.isFinite(value) || value < 0 || value > 1) ||
        Math.abs(probabilities.reduce((sum, value) => sum + value, 0) - 1) > 1e-4) {
        throw new Error('ONNX model outputs failed the runtime contract');
    }

    console.log(JSON.stringify({
        status: 'ONNX_RUNTIME_OK',
        model: result.model,
        embeddingDimensions: result.embedding.length,
        embeddingL2Norm: Number(norm.toFixed(6)),
        padProbabilityCount: probabilities.length,
        padProbabilitiesFinite: true,
        note: 'Synthetic zero tensors only: validates model loading, graph execution and output shapes. It does not validate preprocessing, recognition accuracy, PAD or liveness.'
    }, null, 2));
}

main().catch(error => {
    console.error('[Face ONNX runtime smoke] FAILED:', error.message);
    process.exitCode = 1;
});
