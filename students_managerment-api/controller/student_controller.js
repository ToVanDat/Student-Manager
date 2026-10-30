const studentService = require('../service/studentService.js');
const { buildStudentsCsv } = require('../service/studentCsv.js');

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

const exportStudentsCsv = async (req, res) => {
    try {
        const search = req.query?.search === undefined ? '' : req.query.search;
        const rawClassId = req.query?.classId;
        const classId = rawClassId === undefined || rawClassId === '' ? null : Number(rawClassId);
        const gender = req.query?.gender === undefined ? '' : req.query.gender;

        if (typeof search !== 'string' || search.length > 100) {
            return res.status(400).json({ message: 'Từ khóa tìm kiếm không hợp lệ hoặc quá dài.' });
        }
        if (classId !== null && (!Number.isSafeInteger(classId) || classId <= 0)) {
            return res.status(400).json({ message: 'classId phải là số nguyên dương.' });
        }
        if (typeof gender !== 'string' || !['', 'Nam', 'Nữ'].includes(gender)) {
            return res.status(400).json({ message: 'gender chỉ chấp nhận Nam hoặc Nữ.' });
        }

        const result = await studentService.getStudentExportRows({ search, classId, gender });
        if (result.kind === 'too_many') {
            return res.status(413).json({
                code: 'STUDENT_EXPORT_LIMIT_EXCEEDED',
                maxRows: result.maxRows,
                totalCount: result.totalCount,
                message: `Bộ lọc có ${result.totalCount} bản ghi; giới hạn mỗi lần xuất là ${result.maxRows}. Hãy thu hẹp bộ lọc.`
            });
        }

        const csv = buildStudentsCsv(result.rows);
        const date = new Date().toISOString().slice(0, 10);
        res.set({
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="students-${date}.csv"`,
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff'
        });
        return res.status(200).send(csv);
    } catch (error) {
        return handleStudentError(res, error, 'Không thể xuất danh sách sinh viên.');
    }
};


const previewStudentCsvImport = async (req, res) => {
    try {
        if (!req.file?.buffer) {
            return res.status(400).json({ message: 'Vui lòng chọn tệp CSV.' });
        }
        const preview = await studentService.previewStudentCsvImport(req.file.buffer);
        return res.status(200).json(preview);
    } catch (error) {
        if (error?.statusCode) {
            return res.status(error.statusCode).json({
                code: error.code,
                message: error.message
            });
        }
        return handleStudentError(res, error, 'Không thể kiểm tra tệp CSV.');
    }
};

const importStudentsCsv = async (req, res) => {
    try {
        if (!req.file?.buffer) {
            return res.status(400).json({ message: 'Vui lòng chọn lại tệp CSV.' });
        }
        const result = await studentService.confirmStudentCsvImport(req.file.buffer);
        return res.status(201).json({
            message: 'Nhập danh sách sinh viên thành công.',
            importedCount: result.importedCount
        });
    } catch (error) {
        if (error?.code === 'STUDENT_IMPORT_VALIDATION_FAILED') {
            return res.status(422).json({
                code: error.code,
                message: error.message,
                preview: error.details
            });
        }
        if (error?.code === 'STUDENT_IMPORT_CONFLICT') {
            return res.status(409).json({
                code: error.code,
                message: error.message
            });
        }
        if (error?.statusCode) {
            return res.status(error.statusCode).json({
                code: error.code,
                message: error.message
            });
        }
        return handleStudentError(res, error, 'Không thể nhập danh sách sinh viên.');
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


const getStudentAccountLinks = async (req, res) => {
    try {
        const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
        if (search.length > 100) return res.status(400).json({ message: 'Từ khóa tìm kiếm quá dài.' });
        const data = await studentService.listStudentAccountLinkAdminData(search);
        return res.status(200).json({ data });
    } catch (error) {
        if (error?.code === '42P01' || error?.code === '42703') {
            return res.status(503).json({
                code: 'STUDENT_LINK_SCHEMA_NOT_READY',
                message: 'Cấu trúc liên kết tài khoản sinh viên chưa được cài đặt đầy đủ. Vui lòng kiểm tra migration.'
            });
        }
        return handleStudentError(res, error, 'Không thể tải dữ liệu liên kết tài khoản.');
    }
};

const createStudentAccountLink = async (req, res) => {
    try {
        const result = await studentService.createStudentAccountLink(
            req.body?.userId, req.body?.studentId, req.user.id, req.body
        );
        const responses = {
            invalid_id: [400, 'ID tài khoản hoặc hồ sơ sinh viên không hợp lệ.'],
            invalid_body: [400, 'Dữ liệu yêu cầu không hợp lệ.'],
            invalid_confirmation: [400, 'Cần xác nhận đã kiểm tra danh tính theo quy trình chính thức.'],
            user_unavailable: [409, 'Tài khoản không tồn tại, không hoạt động hoặc không có role user.'],
            student_not_found: [404, 'Không tìm thấy hồ sơ sinh viên.'],
            already_linked: [409, 'Tài khoản hoặc hồ sơ sinh viên đã được liên kết với bản ghi khác.']
        };
        if (result.kind !== 'ok') {
            const [status, message] = responses[result.kind] || [400, 'Không thể tạo liên kết.'];
            return res.status(status).json({ message, code: result.kind });
        }
        return res.status(201).json({ data: result.link, message: 'Đã xác minh và liên kết tài khoản sinh viên.' });
    } catch (error) {
        if (error?.code === '42P01' || error?.code === '42703') {
            return res.status(503).json({ code: 'STUDENT_LINK_SCHEMA_NOT_READY', message: 'Cấu trúc liên kết tài khoản sinh viên chưa được cài đặt đầy đủ.' });
        }
        if (error?.code === '23505') return res.status(409).json({ message: 'Tài khoản hoặc hồ sơ đã được liên kết.' });
        return handleStudentError(res, error, 'Không thể liên kết tài khoản sinh viên.');
    }
};

const deleteStudentAccountLink = async (req, res) => {
    try {
        const result = await studentService.unlinkStudentAccount(req.params.userId, req.user.id, req.body);
        const responses = {
            invalid_id: [400, 'ID tài khoản không hợp lệ.'],
            invalid_body: [400, 'Dữ liệu yêu cầu không hợp lệ.'],
            invalid_reason: [400, 'Lý do hủy liên kết phải có từ 10 đến 500 ký tự.'],
            not_found: [404, 'Không tìm thấy liên kết tài khoản.']
        };
        if (result.kind !== 'ok') {
            const [status, message] = responses[result.kind] || [400, 'Không thể hủy liên kết.'];
            return res.status(status).json({ message, code: result.kind });
        }
        return res.status(200).json({ data: result, message: 'Đã hủy liên kết; lịch sử thao tác được lưu lại.' });
    } catch (error) {
        if (error?.code === '42P01') return res.status(503).json({ code: 'STUDENT_LINK_SCHEMA_NOT_READY', message: 'Bảng lịch sử liên kết chưa được cài đặt.' });
        return handleStudentError(res, error, 'Không thể hủy liên kết tài khoản.');
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
    exportStudentsCsv,
    previewStudentCsvImport,
    importStudentsCsv,
    getMyStudentPortal,
    getStudentAccountLinks,
    createStudentAccountLink,
    deleteStudentAccountLink,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent
};