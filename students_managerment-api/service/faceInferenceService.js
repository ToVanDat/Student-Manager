'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { prepareFaceInferenceTensors } = require('./facePreprocessingService.js');

const EXPECTED_HASHES = Object.freeze({
    'mobile_facenet.onnx': '3ac0b9597efd5dc49c5397e5c21269f98cceb42e7193fcc1afbb0fa992c88e4e',
    'mobile_facenet.data': '5164ee5cdd52328da0b1959913e23fd1866b1696b690fc4ad0bbc5cd32ae319c',
    'metadata.json': '2639a8261232328665a2a6204abc8e41805730f323feda1a1c147006685fe92e',
    'minifasnet-v2.onnx': 'd7b3cd9ba8a7ceb13baa8c4720902e27ca3112eff52f926c08804af6b6eecc7b'
});
// MiniFASNet V2 class order is pinned to the upstream Silent-Face-Anti-Spoofing
// inference contract: index 1 is bona fide; indices 0 and 2 are attack classes.
// The ONNX export is hash-pinned above. Do not relabel attack subclasses as
// print/replay without an independently verified class mapping.
const PAD_MODEL_CONTRACT = Object.freeze({
    input: Object.freeze({ width: 80, height: 80, layout: 'BGR-NCHW', range: Object.freeze([0, 1]) }),
    output: Object.freeze({
        semantics: 'logits',
        classOrder: Object.freeze(['attack_class_0', 'bona_fide', 'attack_class_2']),
        bonaFideIndex: 1
    }),
    upstream: 'https://github.com/minivision-ai/Silent-Face-Anti-Spoofing/blob/master/src/anti_spoof_predict.py',
    onnxExport: 'https://huggingface.co/garciafido/minifasnet-v2-anti-spoofing-onnx/commit/d29c87568ca9b5662da803b10f217c4db20b142b'
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

function resolveArtifactPath(fileName) {
    const subdirectory = fileName.startsWith('mobile_facenet') || fileName === 'metadata.json' ? 'recognition' : 'anti-spoofing';
    const candidates = [
        path.join(MODEL_DIR, subdirectory, fileName),
        path.join(MODEL_DIR, 'face-models', subdirectory, fileName),
        path.join(MODEL_DIR, fileName)
    ];
    return candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || candidates[0];
}

function verifyArtifact(fileName) {
    const filePath = resolveArtifactPath(fileName);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        throw configError('Thiếu model Face Login: ' + fileName + ' (recognition/ hoặc anti-spoofing/)');
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

function classProbabilities(logits) {
    if (!logits || logits.length !== 3 || Array.from(logits).some(value => !Number.isFinite(value))) {
        throw configError('MiniFASNet phải trả về đúng 3 logits hữu hạn');
    }
    // The pinned upstream PyTorch inference applies F.softmax(model.forward(...))
    // outside the model. The ONNX export preserves model.forward logits, so always
    // apply stable softmax; never infer output semantics from the numeric values.
    const scores = Array.from(logits);
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
    verifyArtifact('metadata.json');
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
// Layout: RGB NCHW [1,3,112,112], float32 [0,1]. The exported graph has
// two image inputs and returns one 128-D embedding per input. For a single
// capture frame, the same aligned crop is supplied to both inputs; row 0 is used.
// Input values are RGB float32 in [0,1], as pinned by the supplied model metadata.
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
    const bonaFideProbability = probabilities[PAD_MODEL_CONTRACT.output.bonaFideIndex];
    return {
        embedding,
        pad: {
            bonaFideProbability,
            attackProbability: probabilities[0] + probabilities[2],
            classProbabilities: {
                attackClass0: probabilities[0],
                bonaFide: bonaFideProbability,
                attackClass2: probabilities[2]
            },
            score: bonaFideProbability
        },
        liveness: tensors.liveness,
        model: { id: 'mobilefacenet+minifasnet-v2', version: 'supplied-bundle-v1' }
    };
}

async function ensureFaceInferenceReady() {
    await getRuntime();
    return true;
}

module.exports = { inferFaceImage, inferAlignedFace, ensureFaceInferenceReady, l2Normalize, classProbabilities, assertPixels, resolveArtifactPath, EXPECTED_HASHES, PAD_MODEL_CONTRACT };
