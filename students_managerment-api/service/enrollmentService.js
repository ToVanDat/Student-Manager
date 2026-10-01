const enrollmentRepository = require('../repository/enrollmentRepository.js');


// Lấy tất cả đăng ký môn học
const getAllEnrollments = async () => {
    return await enrollmentRepository.getAllEnrollments();
};


// Lấy đăng ký môn học theo ID
const getEnrollmentById = async (id) => {
    return await enrollmentRepository.getEnrollmentById(id);
};


// Thêm đăng ký môn học
const createEnrollment = async (data) => {
    return await enrollmentRepository.createEnrollment(data);
};


// Cập nhật đăng ký môn học
const updateEnrollment = async (id, data) => {
    return await enrollmentRepository.updateEnrollment(id, data);
};


// Xóa đăng ký môn học
const deleteEnrollment = async (id) => {
    return await enrollmentRepository.deleteEnrollment(id);
};


module.exports = {
    getAllEnrollments,
    getEnrollmentById,
    createEnrollment,
    updateEnrollment,
    deleteEnrollment
};