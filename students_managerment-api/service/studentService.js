const studentRepository = require('../repository/studentRepository');

const getAllStudents = async () => {
    return await studentRepository.getAllStudents();
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
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent
};