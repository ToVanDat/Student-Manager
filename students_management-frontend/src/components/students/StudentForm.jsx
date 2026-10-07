import { useEffect, useState } from 'react';

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
        <div className="rounded-b-xl bg-white dark:bg-slate-900">
            <h2 className="sr-only">
                {student
                    ? 'Cập nhật sinh viên'
                    : 'Thêm sinh viên'}
            </h2>

            <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
                {/* Mã sinh viên */}
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Mã sinh viên</label>

                    <input
                        className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        type="text"
                        name="student_code"
                        value={formData.student_code}
                        onChange={handleChange}
                        required
                    />

                    {errors.student_code && (
                        <p className="m-0 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                            {errors.student_code}
                        </p>
                    )}
                </div>

                {/* Họ tên */}
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Họ và tên</label>

                    <input
                        className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                    />

                    {errors.name && (
                        <p className="m-0 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                            {errors.name}
                        </p>
                    )}
                </div>

                {/* Email */}
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Email</label>

                    <input
                        className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                    />

                    {errors.email && (
                        <p className="m-0 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                            {errors.email}
                        </p>
                    )}
                </div>

                {/* Ngày sinh */}
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Ngày sinh</label>

                    <input
                        className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        type="date"
                        name="date_of_birth"
                        value={formData.date_of_birth}
                        onChange={handleChange}
                    />

                    {errors.date_of_birth && (
                        <p className="m-0 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                            {errors.date_of_birth}
                        </p>
                    )}
                </div>

                {/* Giới tính */}
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Giới tính</label>

                    <select
                        className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                        <p className="m-0 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                            {errors.gender}
                        </p>
                    )}
                </div>

                {/* ID lớp */}
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">ID lớp</label>

                    <input
                        className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        type="number"
                        name="class_id"
                        value={formData.class_id}
                        onChange={handleChange}
                        min="1"
                        required
                    />

                    {errors.class_id && (
                        <p className="m-0 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                            {errors.class_id}
                        </p>
                    )}
                </div>

                {/* Buttons */}
                <div className="col-span-full mt-2 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-5 dark:border-slate-800">
                    <button
                        type="submit"
                        className="rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                        {student
                            ? 'Cập nhật'
                            : 'Thêm sinh viên'}
                    </button>

                    {student && (
                        <button
                            type="button"
                            className="rounded-md bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
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