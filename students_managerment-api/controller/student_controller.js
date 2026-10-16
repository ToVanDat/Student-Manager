const studentService = require('../service/studentService.js');

const handleStudentError = (res, error, fallbackMessage) => {
    // Log database details for operators, but never echo SQL/constraint details to clients.
    console.error('[STUDENTS]', {
        code: error?.code,
        message: error?.message
    });

    if (error?.code === '23505') {
        return res.status(409).json({
            message: 'Mã sinh viên hoặc email đã tồn tại.'
        });
    }

    if (error?.code === '23503') {
        return res.status(409).json({
            message: 'Không thể thực hiện thao tác vì lớp hoặc dữ liệu liên quan không hợp lệ hoặc đang được sử dụng.'
        });
    }

    if (error?.code === '22P02' || error?.code === '22007' || error?.code === '22008') {
        return res.status(400).json({
            message: 'Dữ liệu không đúng định dạng.'
        });
    }

    return res.status(500).json({ message: fallbackMessage });
};

const getAllStudents = async (req, res) => {
    try {
        const students = await studentService.getAllStudents();

        res.json(students);

    } catch (error) {
        return handleStudentError(res, error, 'Không thể tải danh sách sinh viên.');
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
        return handleStudentError(res, error, 'Không thể tải thông tin sinh viên.');
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
        return handleStudentError(res, error, 'Không thể thêm sinh viên.');
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
        return handleStudentError(res, error, 'Không thể cập nhật sinh viên.');
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
        return handleStudentError(res, error, 'Không thể xóa sinh viên.');
    }
};

module.exports = {
    getAllStudents,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent
};