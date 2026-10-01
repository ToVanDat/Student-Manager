// xác thực dữ liệu students
const validateStudent = (req, res, next) => {
    const {
        student_code,
        name,
        email,
        date_of_birth,
        gender,
        class_id
    } = req.body;

    const errors = {};

// student code
    if (!student_code || !student_code.trim()) {
        errors.student_code = 'Vui lòng nhập mã sinh viên';
    } else if (student_code.trim().length > 10) {
        errors.student_code =
            'Mã sinh viên không được vượt quá 10 ký tự';
    }

// name
    if (!name || !name.trim()) {
        errors.name = 'Vui lòng nhập họ và tên';
    } else if (name.trim().length > 20) {
        errors.name =
            'Họ và tên không được vượt quá 20 ký tự';
    }

    // email
    if (!email || !email.trim()) {
        errors.email = 'Vui lòng nhập email';
    } else {
        const emailRegex =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email.trim())) {
            errors.email = 'Email không hợp lệ';
        } else if (email.trim().length > 50) {
            errors.email =
                'Email không được vượt quá 50 ký tự';
        }
    }

    // date_of_birth
    if (date_of_birth) {
        const birthDate = new Date(date_of_birth);
        const today = new Date();

        if (isNaN(birthDate.getTime())) {
            errors.date_of_birth =
                'Ngày sinh không hợp lệ';
        } else if (birthDate > today) {
            errors.date_of_birth =
                'Ngày sinh không được lớn hơn ngày hiện tại';
        }
    }

    // gender
    if (
        gender &&
        !['Nam', 'Nữ'].includes(gender)
    ) {
        errors.gender = 'Giới tính không hợp lệ';
    }

    // class_id
    if (
        class_id === undefined ||
        class_id === null ||
        class_id === ''
    ) {
        errors.class_id = 'Vui lòng nhập ID lớp';
    } else if (
        !Number.isInteger(Number(class_id)) ||
        Number(class_id) <= 0
    ) {
        errors.class_id =
            'ID lớp phải là số nguyên lớn hơn 0';
    }

    // Nếu có lỗi
    if (Object.keys(errors).length > 0) {
        return res.status(400).json({
            message: 'Dữ liệu không hợp lệ',
            errors
        });
    }

    next();
};

module.exports = validateStudent;