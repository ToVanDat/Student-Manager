import { useEffect, useState } from 'react';
import './studentForm.css';

// form infomation student and validation 
function StudentForm({ student, onSubmit, onCancel }) {
    const [formData, setFormData] = useState({
        student_code: '',
        name: '',
        email: '',
        date_of_birth: '',
        gender: '',
        class_id: ''
    });

    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (student) {
            setFormData({
                student_code: student.student_code || '',
                name: student.name || '',
                email: student.email || '',
                date_of_birth: student.date_of_birth
                    ? student.date_of_birth.substring(0, 10)
                    : '',
                gender: student.gender || '',
                class_id: student.class_id || ''
            });
        } else {
            setFormData({
                student_code: '',
                name: '',
                email: '',
                date_of_birth: '',
                gender: '',
                class_id: ''
            });
        }

        setErrors({});
    }, [student]);

    const handleChange = (event) => {
        const { name, value } = event.target;

        setFormData((prev) => ({
            ...prev,
            [name]: value
        }));

        // Xóa lỗi của trường đang nhập
        setErrors((prev) => ({
            ...prev,
            [name]: ''
        }));
    };

    const validateForm = () => {
        const newErrors = {};

        // Mã sinh viên
        if (!formData.student_code.trim()) {
            newErrors.student_code = 'Vui lòng nhập mã sinh viên';
        } else if (formData.student_code.trim().length > 10) {
            newErrors.student_code =
                'Mã sinh viên không được vượt quá 10 ký tự';
        }

        // Họ tên
        if (!formData.name.trim()) {
            newErrors.name = 'Vui lòng nhập họ và tên';
        } else if (formData.name.trim().length > 20) {
            newErrors.name =
                'Họ và tên không được vượt quá 20 ký tự';
        }

        // Email
        if (!formData.email.trim()) {
            newErrors.email = 'Vui lòng nhập email';
        } else {
            const emailRegex =
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailRegex.test(formData.email)) {
                newErrors.email = 'Email không hợp lệ';
            } else if (formData.email.length >50) {
                newErrors.email =
                    'Email không được vượt quá 50 ký tự';
            }
        }

        // Ngày sinh
        if (formData.date_of_birth) {
            const birthDate = new Date(formData.date_of_birth);
            const today = new Date();

            if (birthDate > today) {
                newErrors.date_of_birth =
                    'Ngày sinh không được lớn hơn ngày hiện tại';
            }
        }

        // Giới tính
        if (
            formData.gender &&
            !['Nam', 'Nữ'].includes(formData.gender)
        ) {
            newErrors.gender = 'Giới tính không hợp lệ';
        }

        // Class ID
        if (!formData.class_id) {
            newErrors.class_id = 'Vui lòng nhập ID lớp';
        } else if (Number(formData.class_id) <= 0) {
            newErrors.class_id =
                'ID lớp phải lớn hơn 0';
        }

        setErrors(newErrors);

        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (event) => {
        event.preventDefault();

        // Kiểm tra dữ liệu trước khi gửi
        if (!validateForm()) {
            return;
        }

        onSubmit({
            ...formData,
            student_code: formData.student_code.trim(),
            name: formData.name.trim(),
            email: formData.email.trim(),
            class_id: Number(formData.class_id)
        });
    };

    return (
        <div className="form-container">
            <h2>
                {student
                    ? 'Cập nhật sinh viên'
                    : 'Thêm sinh viên'}
            </h2>

            <form onSubmit={handleSubmit}>
                {/* Mã sinh viên */}
                <div className="form-group">
                    <label>Mã sinh viên</label>

                    <input
                        type="text"
                        name="student_code"
                        value={formData.student_code}
                        onChange={handleChange}
                        required
                    />

                    {errors.student_code && (
                        <p className="error">
                            {errors.student_code}
                        </p>
                    )}
                </div>

                {/* Họ tên */}
                <div className="form-group">
                    <label>Họ và tên</label>

                    <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                    />

                    {errors.name && (
                        <p className="error">
                            {errors.name}
                        </p>
                    )}
                </div>

                {/* Email */}
                <div className="form-group">
                    <label>Email</label>

                    <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                    />

                    {errors.email && (
                        <p className="error">
                            {errors.email}
                        </p>
                    )}
                </div>

                {/* Ngày sinh */}
                <div className="form-group">
                    <label>Ngày sinh</label>

                    <input
                        type="date"
                        name="date_of_birth"
                        value={formData.date_of_birth}
                        onChange={handleChange}
                    />

                    {errors.date_of_birth && (
                        <p className="error">
                            {errors.date_of_birth}
                        </p>
                    )}
                </div>

                {/* Giới tính */}
                <div className="form-group">
                    <label>Giới tính</label>

                    <select
                        name="gender"
                        value={formData.gender}
                        onChange={handleChange}
                    >
                        <option value="">
                            -- Chọn giới tính --
                        </option>

                        <option value="Nam">
                            Nam
                        </option>

                        <option value="Nữ">
                            Nữ
                        </option>
                    </select>

                    {errors.gender && (
                        <p className="error">
                            {errors.gender}
                        </p>
                    )}
                </div>

                {/* ID lớp */}
                <div className="form-group">
                    <label>ID lớp</label>

                    <input
                        type="number"
                        name="class_id"
                        value={formData.class_id}
                        onChange={handleChange}
                        min="1"
                        required
                    />

                    {errors.class_id && (
                        <p className="error">
                            {errors.class_id}
                        </p>
                    )}
                </div>

                {/* Buttons */}
                <div className="form-buttons">
                    <button
                        type="submit"
                        className="btn-save"
                    >
                        {student
                            ? 'Cập nhật'
                            : 'Thêm sinh viên'}
                    </button>

                    {student && (
                        <button
                            type="button"
                            className="btn-cancel"
                            onClick={onCancel}
                        >
                            Hủy
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
}

export default StudentForm;