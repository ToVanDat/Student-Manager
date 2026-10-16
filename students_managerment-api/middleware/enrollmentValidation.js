const ID_FIELDS = ['student_id', 'subject_id', 'semester_id'];
const SCORE_FIELDS = ['midterm_score', 'final_score', 'total_score'];
const ALLOWED_FIELDS = new Set([...ID_FIELDS, ...SCORE_FIELDS]);

function normalizeId(value) {
    if (typeof value === 'string' && !/^\d+$/.test(value.trim())) return null;
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function normalizeScore(value) {
    if (value === null || value === '') return { valid: true, value: null };
    if (typeof value === 'string' && value.trim() === '') return { valid: true, value: null };
    if (typeof value !== 'number' && typeof value !== 'string') return { valid: false };
    const number = Number(value);
    return Number.isFinite(number) ? { valid: true, value: number } : { valid: false };
}

function validateEnrollment(body, { partial = false } = {}) {
    const errors = {};
    const data = {};
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { valid: false, errors: { body: 'Dữ liệu gửi lên phải là một đối tượng JSON' }, data };
    }

    const keys = Object.keys(body);
    for (const key of keys) {
        if (!ALLOWED_FIELDS.has(key)) errors[key] = 'Trường dữ liệu không được hỗ trợ';
    }

    if (partial && keys.length === 0) {
        errors.body = 'Cần cung cấp ít nhất một trường cần cập nhật';
    }

    for (const field of ID_FIELDS) {
        if (!partial && (body[field] === undefined || body[field] === null || body[field] === '')) {
            errors[field] = 'Trường này là bắt buộc';
            continue;
        }
        if (body[field] === undefined && partial) continue;
        const value = normalizeId(body[field]);
        if (value === null) errors[field] = 'ID phải là số nguyên dương';
        else data[field] = value;
    }

    for (const field of SCORE_FIELDS) {
        if (body[field] === undefined) {
            if (!partial) data[field] = null;
            continue;
        }
        const result = normalizeScore(body[field]);
        if (!result.valid) errors[field] = 'Điểm phải là số hữu hạn hoặc để trống';
        else data[field] = result.value;
    }

    return { valid: Object.keys(errors).length === 0, errors, data };
}

module.exports = { validateEnrollment };
