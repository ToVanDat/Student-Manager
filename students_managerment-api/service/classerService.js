const classerRepository = require('../repository/classerRepository.js');


// Lấy tất cả lớp
const getAllClasses = async () => {
    return await classerRepository.getAllClasses();
};


// Lấy lớp theo ID
const getClassById = async (id) => {
    return await classerRepository.getClassById(id);
};


// Thêm lớp
const createClass = async (data) => {
    return await classerRepository.createClass(data);
};


// Cập nhật lớp
const updateClass = async (id, data) => {
    return await classerRepository.updateClass(id, data);
};


// Xóa lớp
const deleteClass = async (id) => {
    return await classerRepository.deleteClass(id);
};


module.exports = {
    getAllClasses,
    getClassById,
    createClass,
    updateClass,
    deleteClass
};