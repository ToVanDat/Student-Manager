// Validate the shared student create/update payload at the API boundary.
const validateStudent = (req, res, next) => {
    const {
        student_code,
        name,
        email,
        date_of_birth,
        gender,
        class_id
    } = req.body || {};

    const errors = {};

    // student_code
    if (typeof student_code !== 'string' || !student_code.trim()) {
        errors.student_code = 'Vui lòng nhập mã sinh viên';
    } else if (student_code.trim().length > 10) {
        errors.student_code = 'Mã sinh viên không được vượt quá 10 ký tự';
    }

    // name
    if (typeof name !== 'string' || !name.trim()) {
        errors.name = 'Vui lòng nhập họ và tên';
    } else if (name.trim().length > 20) {
        errors.name = 'Họ và tên không được vượt quá 20 ký tự';
    }

    // email
    if (typeof email !== 'string' || !email.trim()) {
        errors.email = 'Vui lòng nhập email';
    } else {
        const normalizedEmail = email.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(normalizedEmail)) {
            errors.email = 'Email không hợp lệ';
        } else if (normalizedEmail.length > 50) {
            errors.email = 'Email không được vượt quá 50 ký tự';
        }
    }

    // date_of_birth is optional, but when supplied must be a valid non-future date.
    if (date_of_birth !== undefined && date_of_birth !== null && date_of_birth !== '') {
        if (typeof date_of_birth !== 'string') {
            errors.date_of_birth = 'Ngày sinh không hợp lệ';
        } else {
            const birthDate = new Date(date_of_birth);
            const today = new Date();
            today.setHours(23, 59, 59, 999);

            if (Number.isNaN(birthDate.getTime())) {
                errors.date_of_birth = 'Ngày sinh không hợp lệ';
            } else if (birthDate > today) {
                errors.date_of_birth = 'Ngày sinh không được lớn hơn ngày hiện tại';
            }
        }
    }

    // Gender is optional. Keep the values consistent with the existing form/database.
    if (gender !== undefined && gender !== null && gender !== '' &&
        (typeof gender !== 'string' || !['Nam', 'Nữ'].includes(gender))) {
        errors.gender = 'Giới tính không hợp lệ';
    }

    // class_id may arrive as a numeric string from HTML forms or as a number from API clients.
    const numericClassId = class_id === '' || class_id === null || class_id === undefined
        ? NaN
        : Number(class_id);
    if (!Number.isSafeInteger(numericClassId) || numericClassId <= 0) {
        errors.class_id = class_id === '' || class_id === null || class_id === undefined
            ? 'Vui lòng nhập ID lớp'
            : 'ID lớp phải là số nguyên lớn hơn 0';
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).json({
            message: 'Dữ liệu không hợp lệ',
            errors
        });
    }

    return next();
};

module.exports = validateStudent;
