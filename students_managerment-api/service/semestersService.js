const semestersRepository = require('../repository/semestersRepository.js');


// Lấy tất cả học kỳ
const getAllSemesters = async () => {
    return await semestersRepository.getAllSemesters();
};


// Lấy học kỳ theo ID
const getSemesterById = async (id) => {
    return await semestersRepository.getSemesterById(id);
};


// Thêm học kỳ
const createSemester = async (data) => {
    return await semestersRepository.createSemester(data);
};


// Cập nhật học kỳ
const updateSemester = async (id, data) => {
    return await semestersRepository.updateSemester(id, data);
};


// Xóa học kỳ
const deleteSemester = async (id) => {
    return await semestersRepository.deleteSemester(id);
};


module.exports = {
    getAllSemesters,
    getSemesterById,
    createSemester,
    updateSemester,
    deleteSemester
};