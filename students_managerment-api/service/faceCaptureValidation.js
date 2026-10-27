'use strict';

const { verifyLivenessSequence } = require('./faceLivenessChallenge.js');
const { validateEmbedding } = require('./faceTemplateCrypto.js');

const MIN_CAPTURE_FRAMES = 6;
const MAX_CAPTURE_FRAMES = 40;

function verifyCapturePayload(state, { padThreshold, consistencyThreshold, now = Date.now() }) {
    if (!Number.isFinite(padThreshold) || padThreshold <= 0 || padThreshold > 1 ||
        !Number.isFinite(consistencyThreshold) || consistencyThreshold <= 0 || consistencyThreshold > 1) {
        const error = new Error('Face PAD và frame consistency threshold chưa được hiệu chuẩn.');
        error.code = 'FACE_AUTH_CONFIG_NOT_READY';
        throw error;
    }
    const frames = state?.capture?.frames;
    if (!Array.isArray(frames) || frames.length < MIN_CAPTURE_FRAMES || frames.length > MAX_CAPTURE_FRAMES) {
        const error = new Error('Cần gửi đủ frame để xác minh khuôn mặt sống.');
        error.code = 'FACE_CAPTURE_INCOMPLETE';
        throw error;
    }

    const liveness = verifyLivenessSequence({
        actions: state.liveness.actions,
        frames: frames.map(({ receivedAt, liveness: signals }) => ({ receivedAt, liveness: signals })),
        issuedAt: state.liveness.issuedAt,
        expiresAt: state.liveness.expiresAt,
        now
    });
    if (!liveness.passed) {
        const error = new Error('Không hoàn thành thử thách xác minh khuôn mặt sống.');
        error.code = 'FACE_LIVENESS_FAILED';
        throw error;
    }
    if (frames.some(frame => !Number.isFinite(frame.padScore) || frame.padScore < padThreshold)) {
        const error = new Error('PAD không xác nhận được khuôn mặt thật.');
        error.code = 'FACE_PAD_FAILED';
        throw error;
    }

    const embeddings = frames.map(frame => validateEmbedding(frame.embedding));
    const cosine = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
    const reference = embeddings[0];
    if (embeddings.some(embedding => cosine(reference, embedding) < consistencyThreshold)) {
        const error = new Error('Khuôn mặt thay đổi giữa các frame.');
        error.code = 'FACE_IDENTITY_INCONSISTENT';
        throw error;
    }
    const averaged = reference.map((_, index) =>
        embeddings.reduce((sum, item) => sum + item[index], 0) / embeddings.length
    );
    return validateEmbedding(averaged);
}

module.exports = { verifyCapturePayload };
