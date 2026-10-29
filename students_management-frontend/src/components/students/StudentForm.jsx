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

            if (!emailRegex.test(formData.email.trim())) {
                newErrors.email = t('invalidEmail');
            } else if (formData.email.length >50) {
                newErrors.email =
                    t('emailMax');
            }
        }

        // Ngày sinh
        if (formData.date_of_birth) {
            const today = new Date();
            const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

            // Compare calendar dates, not UTC timestamps, to avoid timezone shifts.
            if (formData.date_of_birth > todayIso) {
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
        <div className="rounded-b-2xl bg-white px-1 pb-1 dark:bg-slate-900 sm:px-2">
            <h2 className="sr-only">
                {student
                    ? t('updateStudent')
                    : t('addStudent')}
            </h2>

            <form className="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2" onSubmit={handleSubmit}>
                {/* Mã sinh viên */}
                <div className="flex flex-col gap-2">
                    <label htmlFor="student-code" className="text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-300">{t('studentCode')}</label>

                    <input
                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.02] outline-none transition duration-150 placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white dark:hover:border-slate-600 dark:focus:bg-slate-800"
                        id="student-code"
                        type="text"
                        name="student_code"
                        aria-invalid={Boolean(errors.student_code)}
                        aria-describedby={errors.student_code ? "student-code-error" : undefined}
                        value={formData.student_code}
                        onChange={handleChange}
                        required
                    />

                    {errors.student_code && (
                        <p id="student-code-error" role="alert" className="m-0 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
                            {errors.student_code}
                        </p>
                    )}
                </div>

                {/* Họ tên */}
                <div className="flex flex-col gap-2">
                    <label htmlFor="student-name" className="text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-300">{t('fullName')}</label>

                    <input
                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.02] outline-none transition duration-150 placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white dark:hover:border-slate-600 dark:focus:bg-slate-800"
                        id="student-name"
                        type="text"
                        name="name"
                        aria-invalid={Boolean(errors.name)}
                        aria-describedby={errors.name ? "student-name-error" : undefined}
                        value={formData.name}
                        onChange={handleChange}
                        required
                    />

                    {errors.name && (
                        <p id="student-name-error" role="alert" className="m-0 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
                            {errors.name}
                        </p>
                    )}
                </div>

                {/* Email */}
                <div className="flex flex-col gap-2">
                    <label htmlFor="student-email" className="text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-300">Email</label>

                    <input
                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.02] outline-none transition duration-150 placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white dark:hover:border-slate-600 dark:focus:bg-slate-800"
                        id="student-email"
                        type="email"
                        name="email"
                        aria-invalid={Boolean(errors.email)}
                        aria-describedby={errors.email ? "student-email-error" : undefined}
                        value={formData.email}
                        onChange={handleChange}
                        required
                    />

                    {errors.email && (
                        <p id="student-email-error" role="alert" className="m-0 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
                            {errors.email}
                        </p>
                    )}
                </div>

                {/* Ngày sinh */}
                <div className="flex flex-col gap-2">
                    <label htmlFor="student-date-of-birth" className="text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-300">{t('dateOfBirth')}</label>

                    <input
                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.02] outline-none transition duration-150 placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white dark:hover:border-slate-600 dark:focus:bg-slate-800"
                        id="student-date-of-birth"
                        type="date"
                        name="date_of_birth"
                        aria-invalid={Boolean(errors.date_of_birth)}
                        aria-describedby={errors.date_of_birth ? "student-date-of-birth-error" : undefined}
                        value={formData.date_of_birth}
                        onChange={handleChange}
                    />

                    {errors.date_of_birth && (
                        <p id="student-date-of-birth-error" role="alert" className="m-0 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
                            {errors.date_of_birth}
                        </p>
                    )}
                </div>

                {/* Giới tính */}
                <div className="flex flex-col gap-2">
                    <label htmlFor="student-gender" className="text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-300">{t('gender')}</label>

                    <select
                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.02] outline-none transition duration-150 placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white dark:hover:border-slate-600 dark:focus:bg-slate-800"
                        id="student-gender"
                        name="gender"
                        value={formData.gender}
                        aria-invalid={Boolean(errors.gender)}
                        aria-describedby={errors.gender ? "student-gender-error" : undefined}
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
                        <p id="student-gender-error" role="alert" className="m-0 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
                            {errors.gender}
                        </p>
                    )}
                </div>

                {/* Class selection from the actual classes API */}
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-300" htmlFor="student-class-id">{t('className')}</label>
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
                        className="min-h-10 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSubmitting || classesLoading || classes.length === 0}
                    >
                        {student
                            ? t('update')
                            : t('addStudent')}
                    </button>

                    {student && (
                        <button
                            type="button"
                            className="min-h-10 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
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