const subjectRepository = require('../repository/subjectRepository.js');


// Lấy tất cả môn học
const getAllSubjects = async () => {
    return await subjectRepository.getAllSubjects();
};


// Lấy môn học theo ID
const getSubjectById = async (id) => {
    return await subjectRepository.getSubjectById(id);
};


// Thêm môn học
const createSubject = async (data) => {
    return await subjectRepository.createSubject(data);
};


// Cập nhật môn học
const updateSubject = async (id, data) => {
    return await subjectRepository.updateSubject(id, data);
};


// Xóa môn học
const deleteSubject = async (id) => {
    return await subjectRepository.deleteSubject(id);
};


module.exports = {
    getAllSubjects,
    getSubjectById,
    createSubject,
    updateSubject,
    deleteSubject
};