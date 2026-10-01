const departmentRepository = require('../repository/departmentRepository.js');


// Lấy tất cả khoa
const getAllDepartments = async () => {
    return await departmentRepository.getAllDepartments();
};


// Lấy khoa theo ID
const getDepartmentById = async (id) => {
    return await departmentRepository.getDepartmentById(id);
};


// Thêm khoa
const createDepartment = async (data) => {
    return await departmentRepository.createDepartment(data);
};


// Cập nhật khoa
const updateDepartment = async (id, data) => {
    return await departmentRepository.updateDepartment(id, data);
};


// Xóa khoa
const deleteDepartment = async (id) => {
    return await departmentRepository.deleteDepartment(id);
};
module.exports = {
    getAllDepartments,
    getDepartmentById,
    createDepartment,
    updateDepartment,
    deleteDepartment
};