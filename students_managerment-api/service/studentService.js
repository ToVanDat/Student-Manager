const studentRepository = require('../repository/studentRepository');
const { validateStudentCsvText } = require('./studentCsvImport.js');

const getAllStudents = async () => {
    return studentRepository.getAllStudents();
};

const getStudentPage = async (query) => {
    return studentRepository.getStudentPage(query);
};

const getStudentExportRows = async (query) => {
    return studentRepository.getStudentExportRows(query);
};



const prepareStudentCsvImport = async (buffer) => {
    const parsed = validateStudentCsvText(buffer.toString('utf8'));
    const candidateRows = parsed.rows.filter(row => row.errors.length === 0);
    const reference = await studentRepository.getStudentImportReferenceData({
        studentCodes: candidateRows.map(row => row.student_code),
        emails: candidateRows.map(row => row.email),
        classCodes: candidateRows.map(row => row.class_code)
    });

    const classMap = new Map(reference.classes.map(row => [
        row.class_code.trim().toLowerCase(),
        { id: row.id, classCode: row.class_code }
    ]));
    const existingCodes = new Set(reference.existingStudentCodes);
    const existingEmails = new Set(reference.existingEmails);

    for (const row of parsed.rows) {
        if (row.errors.length) continue;
        const normalizedCode = row.student_code.toLowerCase();
        const normalizedEmail = row.email.toLowerCase();
        const classInfo = classMap.get(row.class_code.toLowerCase());

        if (!classInfo) row.errors.push('Mã lớp không tồn tại.');
        else row.class_id = classInfo.id;
        if (existingCodes.has(normalizedCode)) row.errors.push('Mã sinh viên đã tồn tại trong hệ thống.');
        if (existingEmails.has(normalizedEmail)) row.errors.push('Email đã tồn tại trong hệ thống.');
    }

    const validRows = parsed.rows.filter(row => row.errors.length === 0);
    const invalidRows = parsed.rows.filter(row => row.errors.length > 0);
    return {
        totalRows: parsed.totalRows,
        validCount: validRows.length,
        invalidCount: invalidRows.length,
        rows: parsed.rows.map(({ class_id, ...row }) => ({ ...row }))
    };
};

const previewStudentCsvImport = async (buffer) => prepareStudentCsvImport(buffer);

const confirmStudentCsvImport = async (buffer) => {
    const preview = await prepareStudentCsvImport(buffer);
    if (preview.invalidCount > 0) {
        const error = new Error('Tệp CSV còn dữ liệu không hợp lệ. Không có bản ghi nào được nhập.');
        error.code = 'STUDENT_IMPORT_VALIDATION_FAILED';
        error.details = preview;
        throw error;
    }
    if (preview.validCount === 0) {
        const error = new Error('Tệp CSV không có sinh viên hợp lệ để nhập.');
        error.code = 'STUDENT_IMPORT_VALIDATION_FAILED';
        error.details = preview;
        throw error;
    }

    const parsed = validateStudentCsvText(buffer.toString('utf8'));
    const rows = parsed.rows.map(({ rowNumber, errors, ...row }) => row);
    return studentRepository.createStudentsFromImport(rows);
};

const getStudentPortalByUserId = async (userId) => {
    return studentRepository.getStudentPortalByUserId(userId);
};

const listStudentAccountLinkAdminData = (search) =>
    studentRepository.listStudentAccountLinkAdminData(search);

const createStudentAccountLink = async (userId, studentId, actorId, payload) => {
    const parsedUserId = Number(userId);
    const parsedStudentId = Number(studentId);
    const parsedActorId = Number(actorId);
    if (![parsedUserId, parsedStudentId, parsedActorId].every(value => Number.isSafeInteger(value) && value > 0)) {
        return { kind: 'invalid_id' };
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
        Object.keys(payload).some(key => !['confirmIdentity', 'verificationNote'].includes(key))) {
        return { kind: 'invalid_body' };
    }
    if (payload.confirmIdentity !== true || (payload.verificationNote !== undefined &&
        (typeof payload.verificationNote !== 'string' || payload.verificationNote.trim().length > 500))) {
        return { kind: 'invalid_confirmation' };
    }
    return studentRepository.createVerifiedStudentAccountLink({
        userId: parsedUserId,
        studentId: parsedStudentId,
        actorId: parsedActorId,
        note: String(payload.verificationNote || '').trim()
    });
};

const unlinkStudentAccount = async (userId, actorId, payload) => {
    const parsedUserId = Number(userId);
    const parsedActorId = Number(actorId);
    if (![parsedUserId, parsedActorId].every(value => Number.isSafeInteger(value) && value > 0)) {
        return { kind: 'invalid_id' };
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
        Object.keys(payload).some(key => key !== 'reason')) {
        return { kind: 'invalid_body' };
    }
    const reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';
    if (reason.length < 10 || reason.length > 500) return { kind: 'invalid_reason' };
    return studentRepository.removeStudentAccountLink({ userId: parsedUserId, actorId: parsedActorId, reason });
};

const getStudentById = async (id) => {
    return await studentRepository.getStudentById(id);
};


const createStudent = async (data) => {
    return await studentRepository.createStudent(data);
};

const updateStudent = async (id, data) => {
    return await studentRepository.updateStudent(id, data);
};


const deleteStudent = async (id) => {
    return await studentRepository.deleteStudent(id);
};


module.exports = {
    getAllStudents,
    getStudentPage,
    getStudentExportRows,
    previewStudentCsvImport,
    confirmStudentCsvImport,
    getStudentPortalByUserId,
    listStudentAccountLinkAdminData,
    createStudentAccountLink,
    unlinkStudentAccount,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent
};