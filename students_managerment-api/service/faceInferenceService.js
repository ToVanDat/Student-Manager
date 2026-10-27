'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { prepareFaceInferenceTensors } = require('./facePreprocessingService.js');

const EXPECTED_HASHES = Object.freeze({
    'mobile_facenet.onnx': '3ac0b9597efd5dc49c5397e5c21269f98cceb42e7193fcc1afbb0fa992c88e4e',
    'mobile_facenet.data': '5164ee5cdd52328da0b1959913e23fd1866b1696b690fc4ad0bbc5cd32ae319c',
    'minifasnet-v2.onnx': 'd7b3cd9ba8a7ceb13baa8c4720902e27ca3112eff52f926c08804af6b6eecc7b'
});
const MODEL_DIR = path.resolve(
    process.env.FACE_MODEL_DIR || path.join(__dirname, '..', 'storage', 'face-models')
);

let runtimePromise;

function configError(message, cause) {
    const error = new Error(message, cause ? { cause } : undefined);
    error.code = 'FACE_INFERENCE_NOT_READY';
    return error;
}

function verifyArtifact(fileName) {
    const filePath = path.join(MODEL_DIR, fileName);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        throw configError('Thiếu model Face Login: ' + fileName);
    }
    const digest = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
    if (digest !== EXPECTED_HASHES[fileName]) {
        throw configError('SHA-256 model Face Login không khớp: ' + fileName);
    }
    return filePath;
}

function l2Normalize(values) {
    if (!values || values.length !== 128) throw configError('MobileFaceNet phải trả về đúng 128 chiều');
    let squared = 0;
    for (const value of values) {
        if (!Number.isFinite(value)) throw configError('MobileFaceNet trả về giá trị không hữu hạn');
        squared += value * value;
    }
    const norm = Math.sqrt(squared);
    if (!Number.isFinite(norm) || norm < 1e-12) throw configError('Embedding MobileFaceNet không hợp lệ');
    return Array.from(values, value => Math.fround(value / norm));
}

function classProbabilities(values) {
    if (!values || values.length !== 3 || Array.from(values).some(value => !Number.isFinite(value))) {
        throw configError('MiniFASNet phải trả về đúng 3 giá trị hữu hạn');
    }
    const scores = Array.from(values);
    const sum = scores.reduce((total, value) => total + value, 0);
    // Some exports include Softmax in the graph, others expose logits.
    // Preserve an already-normalized probability vector; otherwise apply stable Softmax.
    if (scores.every(value => value >= 0 && value <= 1) && Math.abs(sum - 1) <= 1e-3) {
        return scores;
    }
    const max = Math.max(...scores);
    const exps = scores.map(value => Math.exp(value - max));
    const total = exps.reduce((a, b) => a + b, 0);
    return exps.map(value => value / total);
}

function assertPixels(buffer, expectedLength, label) {
    if (!(buffer instanceof Float32Array) || buffer.length !== expectedLength) {
        throw new TypeError(label + ' phải là Float32Array có ' + expectedLength + ' phần tử');
    }
    for (const value of buffer) {
        if (!Number.isFinite(value) || value < 0 || value > 1) {
            throw new TypeError(label + ' phải chứa pixel hữu hạn trong [0,1]');
        }
    }
}

async function createRuntime(ortOverride) {
    let ort = ortOverride;
    if (!ort) {
        try { ort = require('onnxruntime-node'); }
        catch (error) {
            throw configError('Chưa cài onnxruntime-node. Cài dependency theo tài liệu Face Login.', error);
        }
    }

    const mobilePath = verifyArtifact('mobile_facenet.onnx');
    verifyArtifact('mobile_facenet.data');
    const padPath = verifyArtifact('minifasnet-v2.onnx');
    const options = { executionProviders: ['cpu'], graphOptimizationLevel: 'all' };
    const [mobile, pad] = await Promise.all([
        ort.InferenceSession.create(mobilePath, options),
        ort.InferenceSession.create(padPath, options)
    ]);

    if (!mobile.inputNames.includes('img1') || !mobile.inputNames.includes('img2') ||
        !mobile.outputNames.includes('embeddings')) {
        throw configError('Hợp đồng input/output MobileFaceNet không khớp model đã kiểm tra');
    }
    if (mobile.outputNames.length !== 1 || pad.inputNames.length !== 1 || pad.outputNames.length !== 1) {
        throw configError('Hợp đồng input/output MiniFASNet không khớp metadata đã kiểm tra');
    }
    return { ort, mobile, pad, padInputName: pad.inputNames[0], padOutputName: pad.outputNames[0] };
}

async function getRuntime() {
    if (!runtimePromise) {
        runtimePromise = createRuntime().catch(error => {
            runtimePromise = null;
            throw error;
        });
    }
    return runtimePromise;
}

// rgb112 must be produced by a trusted server-side landmark alignment pipeline.
// Layout: RGB NCHW [1,3,112,112], float32 [0,1]. Qualcomm's graph performs
// torchvision normalization and horizontal-flip TTA internally.
async function inferFaceImage(imageBuffer) {
    const tensors = await prepareFaceInferenceTensors(imageBuffer);
    return inferAlignedFace(tensors);
}

async function inferAlignedFace({ rgb112, bgr80 }) {
    assertPixels(rgb112, 3 * 112 * 112, 'rgb112');
    assertPixels(bgr80, 3 * 80 * 80, 'bgr80');
    const runtime = await getRuntime();
    const { ort, mobile, pad, padInputName, padOutputName } = runtime;
    const mobileTensor = new ort.Tensor('float32', rgb112, [1, 3, 112, 112]);
    const padTensor = new ort.Tensor('float32', bgr80, [1, 3, 80, 80]);
    const [mobileResult, padResult] = await Promise.all([
        mobile.run({ img1: mobileTensor, img2: mobileTensor }),
        pad.run({ [padInputName]: padTensor })
    ]);
    const embeddingRows = mobileResult.embeddings.data;
    if (!embeddingRows || embeddingRows.length !== 256) {
        throw configError('MobileFaceNet output phải có đúng 2x128 giá trị');
    }
    const embedding = l2Normalize(embeddingRows.slice(0, 128));
    const probabilities = classProbabilities(padResult[padOutputName].data);
    return {
        embedding,
        pad: {
            liveProbability: probabilities[0],
            printAttackProbability: probabilities[1],
            replayAttackProbability: probabilities[2],
            score: 1 - probabilities[1] - probabilities[2]
        },
        liveness: tensors.liveness,
        model: { id: 'mobilefacenet+minifasnet-v2', version: 'supplied-bundle-v1' }
    };
}

module.exports = { inferFaceImage, inferAlignedFace, l2Normalize, classProbabilities, assertPixels, EXPECTED_HASHES };
