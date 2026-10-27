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
        const queryKeys = ['page', 'pageSize', 'search', 'sortBy', 'sortOrder', 'classId', 'gender'];
        const hasQueryMode = queryKeys.some(key => req.query?.[key] !== undefined);
        if (!hasQueryMode) {
            const students = await studentService.getAllStudents();
            return res.json(students);
        }

        const page = req.query.page === undefined ? 1 : Number(req.query.page);
        const pageSize = req.query.pageSize === undefined ? 10 : Number(req.query.pageSize);
        const search = req.query.search === undefined ? '' : req.query.search;
        const allowedSortBy = new Set([
            'id', 'student_code', 'name', 'email', 'date_of_birth', 'gender', 'class_code', 'class_name'
        ]);
        const sortBy = req.query.sortBy === undefined ? 'id' : req.query.sortBy;
        const sortOrder = req.query.sortOrder === undefined ? 'asc' : String(req.query.sortOrder).toLowerCase();
        const classId = req.query.classId === undefined || req.query.classId === '' ? null : Number(req.query.classId);
        const gender = req.query.gender === undefined ? '' : req.query.gender;

        if (!Number.isSafeInteger(page) || page < 1) {
            return res.status(400).json({ message: 'page phải là số nguyên dương' });
        }
        if (![10, 25, 50].includes(pageSize)) {
            return res.status(400).json({ message: 'pageSize chỉ chấp nhận 10, 25 hoặc 50' });
        }
        if (typeof search !== 'string' || search.length > 100) {
            return res.status(400).json({ message: 'Từ khóa tìm kiếm không hợp lệ hoặc quá dài' });
        }
        if (!allowedSortBy.has(sortBy)) {
            return res.status(400).json({ message: 'Trường sắp xếp không hợp lệ' });
        }
        if (!['asc', 'desc'].includes(sortOrder)) {
            return res.status(400).json({ message: 'sortOrder chỉ chấp nhận asc hoặc desc' });
        }
        if (classId !== null && (!Number.isSafeInteger(classId) || classId <= 0)) {
            return res.status(400).json({ message: 'classId phải là số nguyên dương' });
        }
        if (typeof gender !== 'string' || !['', 'Nam', 'Nữ'].includes(gender)) {
            return res.status(400).json({ message: 'gender chỉ chấp nhận Nam hoặc Nữ' });
        }

        const result = await studentService.getStudentPage({ page, pageSize, search, sortBy, sortOrder, classId, gender });
        return res.status(200).json(result);
    } catch (error) {
        return handleStudentError(res, error, 'Không thể tải danh sách sinh viên.');
    }
};

const getMyStudentPortal = async (req, res) => {
    try {
        const portal = await studentService.getStudentPortalByUserId(req.user.id);
        return res.status(200).json(portal);
    } catch (error) {
        if (error?.code === '42P01') {
            return res.status(503).json({
                code: 'STUDENT_LINK_SCHEMA_NOT_READY',
                message: 'Chức năng hồ sơ sinh viên chưa được cấu hình trên cơ sở dữ liệu. Vui lòng liên hệ quản trị viên.'
            });
        }
        return handleStudentError(res, error, 'Không thể tải cổng thông tin sinh viên.');
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
    getMyStudentPortal,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent
};