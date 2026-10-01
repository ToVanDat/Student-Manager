const enrollmentService = require('../service/enrollmentService.js');


// GET tất cả đăng ký môn học
const getEnrollments = async (req, res) => {
    try {

        const enrollments =
            await enrollmentService.getAllEnrollments();

        res.json(enrollments);

    } catch (error) {

        console.error('LỖI DATABASE:', error);

        res.status(500).json({
            message: 'Database error',
            error: error.message
        });
    }
};


// GET đăng ký môn học theo ID
const getEnrollmentById = async (req, res) => {
    try {

        const { id } = req.params;

        const enrollment =
            await enrollmentService.getEnrollmentById(id);

        if (!enrollment) {
            return res.status(404).json({
                message: 'Không tìm thấy đăng ký môn học'
            });
        }

        res.json(enrollment);

    } catch (error) {

        console.error('LỖI DATABASE:', error);

        res.status(500).json({
            message: 'Database error',
            error: error.message
        });
    }
};


// POST thêm đăng ký môn học
const createEnrollment = async (req, res) => {
    try {

        const enrollment =
            await enrollmentService.createEnrollment(req.body);

        res.status(201).json(enrollment);

    } catch (error) {

        console.error('LỖI DATABASE:', error);

        res.status(500).json({
            message: 'Không thể thêm đăng ký môn học',
            error: error.message
        });
    }
};


// PATCH cập nhật điểm
const updateEnrollment = async (req, res) => {
    try {

        const { id } = req.params;

        const enrollment =
            await enrollmentService.updateEnrollment(
                id,
                req.body
            );

        if (!enrollment) {
            return res.status(404).json({
                message: 'Không tìm thấy đăng ký môn học'
            });
        }

        res.json(enrollment);

    } catch (error) {

        console.error('LỖI DATABASE:', error);

        res.status(500).json({
            message: 'Không thể cập nhật đăng ký môn học',
            error: error.message
        });
    }
};


// DELETE đăng ký môn học
const deleteEnrollment = async (req, res) => {
    try {

        const { id } = req.params;

        const enrollment =
            await enrollmentService.deleteEnrollment(id);

        if (!enrollment) {
            return res.status(404).json({
                message: 'Không tìm thấy đăng ký môn học'
            });
        }

        res.json({
            message: 'Xóa đăng ký môn học thành công',
            enrollment: enrollment
        });

    } catch (error) {

        console.error('LỖI DATABASE:', error);

        res.status(500).json({
            message: 'Không thể xóa đăng ký môn học',
            error: error.message
        });
    }
};


module.exports = {
    getEnrollments,
    getEnrollmentById,
    createEnrollment,
    updateEnrollment,
    deleteEnrollment
};