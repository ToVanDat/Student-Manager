const studentRepository = require('../repository/studentRepository');

const getAllStudents = async () => {
    return studentRepository.getAllStudents();
};

const getStudentPage = async (query) => {
    return studentRepository.getStudentPage(query);
};

const getStudentExportRows = async (query) => {
    return studentRepository.getStudentExportRows(query);
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
    getStudentPortalByUserId,
    listStudentAccountLinkAdminData,
    createStudentAccountLink,
    unlinkStudentAccount,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent
};