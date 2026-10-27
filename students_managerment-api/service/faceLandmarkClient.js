'use strict';

const DEFAULT_URL = 'http://127.0.0.1:3010';

function serviceError(message, code = 'FACE_LANDMARK_SERVICE_UNAVAILABLE') {
    const error = new Error(message);
    error.code = code;
    return error;
}

async function detectFaceLandmarks(imageBuffer) {
    if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0 || imageBuffer.length > 5 * 1024 * 1024) {
        throw serviceError('Ảnh Face Login không hợp lệ', 'FACE_IMAGE_INVALID');
    }
    const token = process.env.FACE_LANDMARK_SERVICE_TOKEN;
    if (!token) throw serviceError('Thiếu FACE_LANDMARK_SERVICE_TOKEN', 'FACE_AUTH_CONFIG_NOT_READY');

    const baseUrl = (process.env.FACE_LANDMARK_SERVICE_URL || DEFAULT_URL).replace(/\/$/, '');
    let url;
    try { url = new URL(baseUrl); }
    catch { throw serviceError('FACE_LANDMARK_SERVICE_URL không hợp lệ', 'FACE_AUTH_CONFIG_INVALID'); }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw serviceError('FACE_LANDMARK_SERVICE_URL phải dùng HTTP nội bộ hoặc HTTPS', 'FACE_AUTH_CONFIG_INVALID');
    }
    if (url.protocol === 'http:' && !['127.0.0.1', 'localhost', '::1'].includes(url.hostname) &&
        process.env.NODE_ENV === 'production' && process.env.FACE_LANDMARK_SERVICE_ALLOW_PRIVATE_HTTP !== 'true') {
        throw serviceError('Production landmark service phải dùng HTTPS hoặc private loopback network', 'FACE_AUTH_CONFIG_INVALID');
    }

    let response;
    try {
        response = await fetch(url.toString() + '/v1/landmarks', {
            method: 'POST',
            headers: {
                authorization: 'Bearer ' + token,
                'content-type': 'application/octet-stream',
            },
            body: imageBuffer,
            signal: AbortSignal.timeout(8000)
        });
    } catch (error) {
        throw serviceError('Không thể kết nối dịch vụ MediaPipe nội bộ');
    }

    if (!response.ok) {
        if (response.status === 422) throw serviceError('Cần có đúng một khuôn mặt rõ ràng trong ảnh', 'FACE_DETECTION_FAILED');
        if (response.status === 401) throw serviceError('Landmark service authentication failed', 'FACE_LANDMARK_SERVICE_AUTH_FAILED');
        if (response.status === 413 || response.status === 415 || response.status === 400) {
            throw serviceError('Ảnh Face Login không hợp lệ', 'FACE_IMAGE_INVALID');
        }
        throw serviceError('Dịch vụ MediaPipe nội bộ chưa sẵn sàng');
    }

    let result;
    try { result = await response.json(); }
    catch { throw serviceError('Landmark service returned an invalid response'); }

    if (!Number.isInteger(result.width) || !Number.isInteger(result.height) ||
        !Array.isArray(result.five) || result.five.length !== 5 ||
        result.five.some(point => !Array.isArray(point) || point.length !== 2 ||
            point.some(value => !Number.isFinite(value))) ||
        !result.bbox || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(result.bbox[key]))) {
        throw serviceError('Landmark service returned invalid coordinates');
    }
    const requiredSignals = ['eyeBlinkLeft', 'eyeBlinkRight', 'mouthSmileLeft', 'mouthSmileRight', 'jawOpen'];
    if (!result.liveness || requiredSignals.some(key =>
        !Number.isFinite(result.liveness[key]) || result.liveness[key] < 0 || result.liveness[key] > 1)) {
        throw serviceError('Landmark service returned incomplete liveness signals', 'FACE_LIVENESS_SIGNALS_INVALID');
    }
    return result;
}

async function ensureLandmarkServiceReady() {
    const token = process.env.FACE_LANDMARK_SERVICE_TOKEN;
    if (!token) throw serviceError('Thiếu FACE_LANDMARK_SERVICE_TOKEN', 'FACE_AUTH_CONFIG_NOT_READY');
    const baseUrl = (process.env.FACE_LANDMARK_SERVICE_URL || DEFAULT_URL).replace(/\\/$/, '');
    let url;
    try { url = new URL(baseUrl); }
    catch { throw serviceError('FACE_LANDMARK_SERVICE_URL không hợp lệ', 'FACE_AUTH_CONFIG_INVALID'); }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw serviceError('FACE_LANDMARK_SERVICE_URL phải dùng HTTP nội bộ hoặc HTTPS', 'FACE_AUTH_CONFIG_INVALID');
    }
    if (url.protocol === 'http:' && !['127.0.0.1', 'localhost', '::1'].includes(url.hostname) &&
        process.env.NODE_ENV === 'production' && process.env.FACE_LANDMARK_SERVICE_ALLOW_PRIVATE_HTTP !== 'true') {
        throw serviceError('Production landmark service phải dùng HTTPS hoặc private loopback network', 'FACE_AUTH_CONFIG_INVALID');
    }
    try {
        const response = await fetch(url.toString() + '/health', {
            headers: { authorization: 'Bearer ' + token },
            signal: AbortSignal.timeout(2500)
        });
        if (!response.ok) throw new Error('not ready');
        const result = await response.json();
        if (result?.ok !== true) throw new Error('not ready');
        return true;
    } catch {
        throw serviceError('Dịch vụ MediaPipe nội bộ chưa sẵn sàng', 'FACE_LANDMARK_SERVICE_UNAVAILABLE');
    }
}

module.exports = { detectFaceLandmarks, ensureLandmarkServiceReady };
