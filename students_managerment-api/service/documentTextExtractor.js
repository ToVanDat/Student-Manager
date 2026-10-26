const path = require('path');
const { TextDecoder } = require('util');
const aiConfig = require('../src/config/ai.js');

const SUPPORTED_TEXT_MIME_TYPES = new Set([
    'text/plain',
    'application/octet-stream'
]);

function getSafeSourceName(originalName) {
    const basename = path.basename(String(originalName || '').replace(/\\\\/g, '/'));
    return basename.slice(0, 255);
}

function extractTextDocument({ buffer, originalName, mimeType }) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        const error = new Error('Tệp tài liệu trống hoặc không hợp lệ');
        error.status = 400;
        throw error;
    }
    if (buffer.length > aiConfig.rag.maxUploadBytes) {
        const error = new Error('Tệp vượt quá giới hạn 1 MB');
        error.status = 413;
        throw error;
    }

    const sourceName = getSafeSourceName(originalName);
    if (!/\\.txt$/i.test(sourceName) || !SUPPORTED_TEXT_MIME_TYPES.has(mimeType)) {
        const error = new Error('Giai đoạn này chỉ hỗ trợ tệp .txt');
        error.status = 415;
        throw error;
    }

    let text;
    try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
        const error = new Error('Tệp không phải văn bản UTF-8 hợp lệ');
        error.status = 400;
        throw error;
    }

    if (text.includes('\\u0000')) {
        const error = new Error('Tệp chứa ký tự nhị phân không hợp lệ');
        error.status = 400;
        throw error;
    }

    text = text.replace(/^\\uFEFF/, '').replace(/\\r\\n?/g, '\\n').trim();
    if (!text) {
        const error = new Error('Tài liệu không có nội dung văn bản');
        error.status = 400;
        throw error;
    }

    return {
        text,
        sourceName,
        mimeType: 'text/plain',
        format: 'txt',
        paragraphCount: text.split(/\\n\\s*\\n/).filter(value => value.trim()).length
    };
}

module.exports = { extractTextDocument, getSafeSourceName, SUPPORTED_TEXT_MIME_TYPES };
