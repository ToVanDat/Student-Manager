import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/api/client.js';
import { useLanguage } from '@/context/LanguageContext.jsx';

// form infomation student and validation 
function StudentForm({ student, onSubmit, onCancel }) {
    const { t } = useLanguage();
    const [formData, setFormData] = useState({
        student_code: '',
        name: '',
        email: '',
        date_of_birth: '',
        gender: '',
        class_id: ''
    });

    const [errors, setErrors] = useState({});
    const [classes, setClasses] = useState([]);
    const [classesLoading, setClassesLoading] = useState(true);
    const [classesError, setClassesError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const loadClasses = useCallback(async () => {
        setClassesLoading(true);
        setClassesError('');
        try {
            const response = await apiClient.get('/api/classes');
            setClasses(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('[STUDENT FORM] Could not load classes:', error?.message);
            setClassesError(t('classesLoadFailed'));
            setClasses([]);
        } finally {
            setClassesLoading(false);
        }
    }, [t]);

    useEffect(() => {
        void loadClasses();
    }, [loadClasses]);

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
            newErrors.student_code = t('enterStudentCode');
        } else if (formData.student_code.trim().length > 10) {
            newErrors.student_code =
                t('studentCodeMax');
        }

        // Họ tên
        if (!formData.name.trim()) {
            newErrors.name = t('enterFullName');
        } else if (formData.name.trim().length > 20) {
            newErrors.name =
                t('fullNameMax');
        }

        // Email
        if (!formData.email.trim()) {
            newErrors.email = t('enterEmail');
        } else {
            const emailRegex =
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailRegex.test(formData.email)) {
                newErrors.email = t('invalidEmail');
            } else if (formData.email.length >50) {
                newErrors.email =
                    t('emailMax');
            }
        }

        // Ngày sinh
        if (formData.date_of_birth) {
            const birthDate = new Date(formData.date_of_birth);
            const today = new Date();

            if (birthDate > today) {
                newErrors.date_of_birth =
                    t('birthDateFuture');
            }
        }

        // Giới tính
        if (
            formData.gender &&
            !['Nam', 'Nữ'].includes(formData.gender)
        ) {
            newErrors.gender = t('invalidGender');
        }

        // Class must be selected from the server-provided list.
        if (!formData.class_id) {
            newErrors.class_id = t('enterClassId');
        } else if (!Number.isSafeInteger(Number(formData.class_id)) || Number(formData.class_id) <= 0) {
            newErrors.class_id = t('classIdPositive');
        } else if (classes.length && !classes.some(item => String(item.id) === String(formData.class_id))) {
            newErrors.class_id = t('selectClass');
        } else if (!classes.length) {
            newErrors.class_id = classesError || t('noClassesAvailable');
        }

        setErrors(newErrors);

        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (isSubmitting || !validateForm()) return;

        setIsSubmitting(true);
        try {
            await onSubmit({
                ...formData,
                student_code: formData.student_code.trim(),
                name: formData.name.trim(),
                email: formData.email.trim(),
                class_id: Number(formData.class_id)
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="rounded-b-xl bg-white dark:bg-slate-900">
            <h2 className="sr-only">
                {student
                    ? t('updateStudent')
                    : t('addStudent')}
            </h2>

            <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
                {/* Mã sinh viên */}
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('studentCode')}</label>

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
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('fullName')}</label>

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
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('dateOfBirth')}</label>

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
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('gender')}</label>

                    <select
                        className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        name="gender"
                        value={formData.gender}
                        onChange={handleChange}
                    >
                        <option value="">
                            {t('chooseGender')}
                        </option>

                        <option value="Nam">
                            {t('male')}
                        </option>

                        <option value="Nữ">
                            {t('female')}
                        </option>
                    </select>

                    {errors.gender && (
                        <p className="m-0 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                            {errors.gender}
                        </p>
                    )}
                </div>

                {/* Class selection from the actual classes API */}
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300" htmlFor="student-class-id">{t('className')}</label>
                    <select
                        id="student-class-id"
                        className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        name="class_id"
                        value={formData.class_id}
                        onChange={handleChange}
                        required
                        disabled={classesLoading || classes.length === 0}
                    >
                        <option value="">{classesLoading ? t('loadingClasses') : classes.length ? t('selectClass') : t('noClassesAvailable')}</option>
                        {classes.map(classItem => (
                            <option key={classItem.id} value={String(classItem.id)}>
                                {classItem.class_code} — {classItem.class_name}
                                {classItem.department_name ? ` · ${classItem.department_name}` : ''}
                            </option>
                        ))}
                    </select>
                    {classesError && (
                        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
                            <span>{classesError}</span>
                            <button type="button" onClick={() => void loadClasses()} disabled={classesLoading} className="font-semibold underline disabled:opacity-50">{t('retry')}</button>
                        </div>
                    )}
                    {errors.class_id && (
                        <p className="m-0 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
                            {errors.class_id}
                        </p>
                    )}
                </div>

                {/* Buttons */}
                <div className="col-span-full mt-2 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-5 dark:border-slate-800">
                    <button
                        type="submit"
                        className="rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSubmitting || classesLoading || classes.length === 0}
                    >
                        {student
                            ? t('update')
                            : t('addStudent')}
                    </button>

                    {student && (
                        <button
                            type="button"
                            className="rounded-md bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                            onClick={onCancel}
                        >
                            {t('cancel')}
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
}

export default StudentForm;