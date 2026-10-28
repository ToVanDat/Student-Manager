const enrollmentService = require('../service/enrollmentService.js');
const { validateEnrollment } = require('../middleware/enrollmentValidation.js');

const isValidId = (value) => /^\d+$/.test(String(value)) && Number(value) > 0 && Number.isSafeInteger(Number(value));


// GET tất cả đăng ký môn học
const getEnrollments = async (req, res) => {
    try {

        const enrollments =
            await enrollmentService.getAllEnrollments();

        res.json(enrollments);

    } catch (error) {

        console.error('[ENROLLMENTS] Database operation failed:', { code: error?.code, name: error?.name });

        return res.status(500).json({
            message: 'Không thể tải danh sách đăng ký môn học'
        });
    }
};


// GET đăng ký môn học theo ID
const getEnrollmentById = async (req, res) => {
    try {

        const { id } = req.params;
        if (!isValidId(id)) return res.status(400).json({ message: 'ID đăng ký môn học không hợp lệ' });

        const enrollment =
            await enrollmentService.getEnrollmentById(id);

        if (!enrollment) {
            return res.status(404).json({
                message: 'Không tìm thấy đăng ký môn học'
            });
        }

        res.json(enrollment);

    } catch (error) {

        console.error('[ENROLLMENTS] Database operation failed:', { code: error?.code, name: error?.name });

        return res.status(500).json({
            message: 'Không thể tải danh sách đăng ký môn học'
        });
    }
};


// POST thêm đăng ký môn học
const createEnrollment = async (req, res) => {
    try {

        const validation = validateEnrollment(req.body);
        if (!validation.valid) {
            return res.status(400).json({ message: 'Dữ liệu đăng ký môn học không hợp lệ', errors: validation.errors });
        }
        const enrollment = await enrollmentService.createEnrollment(validation.data);

        res.status(201).json(enrollment);

    } catch (error) {

        if (error.code === '23505') return res.status(409).json({ message: 'Đăng ký môn học này đã tồn tại' });
        if (error.code === '23503') return res.status(400).json({ message: 'Sinh viên, môn học hoặc học kỳ không tồn tại' });
        console.error('[ENROLLMENTS] Database operation failed:', { code: error?.code, name: error?.name });
        return res.status(500).json({ message: 'Không thể thêm đăng ký môn học' });
    }
};


// PATCH cập nhật điểm
const updateEnrollment = async (req, res) => {
    try {

        const { id } = req.params;
        if (!isValidId(id)) {
            return res.status(400).json({ message: 'ID đăng ký môn học không hợp lệ' });
        }
        const validation = validateEnrollment(req.body, { partial: true });
        if (!validation.valid) {
            return res.status(400).json({ message: 'Dữ liệu cập nhật không hợp lệ', errors: validation.errors });
        }
        const enrollment = await enrollmentService.updateEnrollment(id, validation.data);

        if (!enrollment) {
            return res.status(404).json({
                message: 'Không tìm thấy đăng ký môn học'
            });
        }

        res.json(enrollment);

    } catch (error) {

        if (error.code === '23505') return res.status(409).json({ message: 'Đăng ký môn học này đã tồn tại' });
        if (error.code === '23503') return res.status(400).json({ message: 'Sinh viên, môn học hoặc học kỳ không tồn tại' });
        console.error('[ENROLLMENTS] Database operation failed:', { code: error?.code, name: error?.name });
        return res.status(500).json({ message: 'Không thể cập nhật đăng ký môn học' });
    }
};


// DELETE đăng ký môn học
const deleteEnrollment = async (req, res) => {
    try {

        const { id } = req.params;
        if (!isValidId(id)) return res.status(400).json({ message: 'ID đăng ký môn học không hợp lệ' });

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

        console.error('[ENROLLMENTS] Database operation failed:', { code: error?.code, name: error?.name });

        return res.status(500).json({
            message: 'Không thể xóa đăng ký môn học'
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