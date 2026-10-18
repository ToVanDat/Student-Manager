const studentRepository = require('../repository/studentRepository');

const getAllStudents = async () => {
    return studentRepository.getAllStudents();
};

const getStudentPage = async (query) => {
    return studentRepository.getStudentPage(query);
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
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent
};