const studentService = require('../service/studentService.js');

const getAllStudents = async (req, res) => {
    try {
        const students = await studentService.getAllStudents();

        res.json(students);

    } catch (error) {
        console.error('LỖI DATABASE:', error);

        res.status(500).json({
            message: 'Database error',
            error: error.message
        });
    }
};

const getStudentById = async (req, res) => {
    try {
        const { id } = req.params;

        const student = await studentService.getStudentById(id);

        if (!student) {
            return res.status(404).json({
                message: 'Không tìm thấy sinh viên'
            });
        }

        res.json(student);

    } catch (error) {
        console.error('LỖI DATABASE:', error);

        res.status(500).json({
            message: 'Database error',
            error: error.message
        });
    }
};

const createStudent = async (req, res) => {
    try {
        const student = await studentService.createStudent(req.body);

        res.status(201).json({
            data: student,
            message: 'Thêm sinh viên thành công',
            code: 201,
        });

    } catch (error) {
        console.error('LỖI DATABASE:', error);

        res.status(500).json({
            message: 'Không thể thêm sinh viên',
            error: error.message
        });
    }
};

const updateStudent = async (req, res) => {
    try {
        const { id } = req.params;

        const student = await studentService.updateStudent(
            id,
            req.body
        );

        if (!student) {
            return res.status(404).json({
                message: 'Không tìm thấy sinh viên'
            });
        }

        res.json(student);

    } catch (error) {
        console.error('LỖI DATABASE:', error);

        res.status(500).json({
            message: 'Không thể cập nhật sinh viên',
            error: error.message
        });
    }
};

const deleteStudent = async (req, res) => {
    try {
        const { id } = req.params;

        const student = await studentService.deleteStudent(id);

        if (!student) {
            return res.status(404).json({
                message: 'Không tìm thấy sinh viên'
            });
        }

        res.json({
            message: 'Xóa sinh viên thành công',
            student: student
        });

    } catch (error) {
        console.error('LỖI DATABASE:', error);

        res.status(500).json({
            message: 'Không thể xóa sinh viên',
            error: error.message
        });
    }
};

module.exports = {
    getAllStudents,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent
};