'use strict';

const { getRuntime } = require('../service/faceInferenceService.js');

async function main() {
    // Synthetic tensors validate native ONNX loading, graph execution and output
    // dimensions only. PAD class semantics are intentionally not interpreted here.
    const runtime = await getRuntime();
    const { ort, mobile, pad, padInputName, padOutputName } = runtime;
    const rgb112 = new Float32Array(3 * 112 * 112);
    const bgr80 = new Float32Array(3 * 80 * 80);
    const mobileTensor = new ort.Tensor('float32', rgb112, [1, 3, 112, 112]);
    const padTensor = new ort.Tensor('float32', bgr80, [1, 3, 80, 80]);
    const [mobileResult, padResult] = await Promise.all([
        mobile.run({ img1: mobileTensor, img2: mobileTensor }),
        pad.run({ [padInputName]: padTensor })
    ]);
    const embeddingValues = mobileResult.embeddings?.data;
    const padValues = padResult[padOutputName]?.data;
    if (!embeddingValues || embeddingValues.length !== 256 ||
        !padValues || padValues.length !== 3 ||
        Array.from(padValues).some(value => !Number.isFinite(value))) {
        throw new Error('ONNX graph output shapes/values failed runtime validation');
    }

    console.log(JSON.stringify({
        status: 'ONNX_RUNTIME_OK',
        embeddingDimensionsPerImage: 128,
        padOutputCount: padValues.length,
        padOutputSemantics: 'UNVERIFIED_NOT_INTERPRETED',
        note: 'Synthetic zero tensors only. This validates graph loading/execution and output shape; it does not establish class order, logits-vs-probabilities, preprocessing parity, recognition accuracy or PAD accuracy.'
    }, null, 2));
}

main().catch(error => {
    console.error('[Face ONNX runtime smoke] FAILED:', error.message);
    process.exitCode = 1;
});
