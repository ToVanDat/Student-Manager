// Validate student payloads at the API boundary.
// Create requires the core fields; PATCH validates only fields explicitly supplied.
const validateStudent = ({ partial = false } = {}) => (req, res, next) => {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? req.body
        : {};
    const has = (field) => Object.prototype.hasOwnProperty.call(body, field);
    const {
        student_code,
        name,
        email,
        date_of_birth,
        gender,
        class_id
    } = body;

    const errors = {};
    const shouldValidate = (field) => !partial || has(field);

    if (partial && !['student_code', 'name', 'email', 'date_of_birth', 'gender', 'class_id'].some(has)) {
        return res.status(400).json({
            message: 'Cần cung cấp ít nhất một trường hợp lệ để cập nhật sinh viên',
            errors: { body: 'Không có trường dữ liệu nào để cập nhật' }
        });
    }

    if (shouldValidate('student_code')) {
        if (typeof student_code !== 'string' || !student_code.trim()) {
            errors.student_code = 'Vui lòng nhập mã sinh viên';
        } else if (student_code.trim().length > 10) {
            errors.student_code = 'Mã sinh viên không được vượt quá 10 ký tự';
        }
    }

    if (shouldValidate('name')) {
        if (typeof name !== 'string' || !name.trim()) {
            errors.name = 'Vui lòng nhập họ và tên';
        } else if (name.trim().length > 20) {
            errors.name = 'Họ và tên không được vượt quá 20 ký tự';
        }
    }

    if (shouldValidate('email')) {
        if (typeof email !== 'string' || !email.trim()) {
            errors.email = 'Vui lòng nhập email';
        } else {
            const normalizedEmail = email.trim();
            const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;

            if (!emailRegex.test(normalizedEmail)) {
                errors.email = 'Email không hợp lệ';
            } else if (normalizedEmail.length > 50) {
                errors.email = 'Email không được vượt quá 50 ký tự';
            }
        }
    }

    if (shouldValidate('date_of_birth') &&
        date_of_birth !== undefined && date_of_birth !== null && date_of_birth !== '') {
        if (typeof date_of_birth !== 'string' || !/^\\d{4}-\\d{2}-\\d{2}$/.test(date_of_birth)) {
            errors.date_of_birth = 'Ngày sinh không hợp lệ';
        } else {
            const birthDate = new Date(date_of_birth);
            const [year, month, day] = date_of_birth.split('-').map(Number);
            const isRealCalendarDate = birthDate.getUTCFullYear() === year &&
                birthDate.getUTCMonth() + 1 === month &&
                birthDate.getUTCDate() === day;
            const today = new Date();
            today.setHours(23, 59, 59, 999);

            if (Number.isNaN(birthDate.getTime()) || !isRealCalendarDate) {
                errors.date_of_birth = 'Ngày sinh không hợp lệ';
            } else if (birthDate > today) {
                errors.date_of_birth = 'Ngày sinh không được lớn hơn ngày hiện tại';
            }
        }
    }

    if (shouldValidate('gender') && gender !== undefined && gender !== null && gender !== '' &&
        (typeof gender !== 'string' || !['Nam', 'Nữ'].includes(gender))) {
        errors.gender = 'Giới tính không hợp lệ';
    }

    if (shouldValidate('class_id')) {
        const numericClassId = class_id === '' || class_id === null || class_id === undefined
            ? NaN
            : Number(class_id);
        if (!Number.isSafeInteger(numericClassId) || numericClassId <= 0) {
            errors.class_id = class_id === '' || class_id === null || class_id === undefined
                ? 'Vui lòng nhập ID lớp'
                : 'ID lớp phải là số nguyên lớn hơn 0';
        }
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).json({
            message: 'Dữ liệu không hợp lệ',
            errors
        });
    }

    return next();
};

const validateStudentCreate = validateStudent();
const validateStudentUpdate = validateStudent({ partial: true });

module.exports = validateStudentCreate;
module.exports.partial = validateStudentUpdate;
