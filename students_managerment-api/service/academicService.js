const academicRepository = require('../repository/academicRepository.js');

function parseOptionalSemesterId(value) {
    if (value === undefined || value === null || value === '') return { valid: true, value: null };
    if (!/^\d+$/.test(String(value))) return { valid: false, value: null };
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? { valid: true, value: parsed } : { valid: false, value: null };
}

async function getMyProfile(userId) {
    const student = await academicRepository.getVerifiedStudentByUserId(userId);
    return {
        status: student ? 'linked' : 'not_linked',
        student,
        linked: Boolean(student)
    };
}

async function getMyGrades(userId, semesterId = null) {
    return academicRepository.getStudentPortalByUserId(userId, semesterId);
}

async function getStudentByCode(studentCode, semesterId = null) {
    const normalized = typeof studentCode === 'string' ? studentCode.trim() : '';
    if (!normalized || normalized.length > 100) {
        const error = new Error('Mã sinh viên không hợp lệ');
        error.status = 400;
        throw error;
    }
    return academicRepository.getStudentPortalByCode(normalized, semesterId);
}

module.exports = { parseOptionalSemesterId, getMyProfile, getMyGrades, getStudentByCode };
