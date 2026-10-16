import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, GraduationCap, Mail, RefreshCw, UserRound, X } from 'lucide-react';
import { getStudentById } from '@/api/studentApi.js';
import { useLanguage } from '@/context/LanguageContext.jsx';

function DetailRow({ label, value, icon: Icon }) {
    return (
        <div className="flex min-w-0 items-start gap-3 border-b border-slate-100 py-3 last:border-b-0 dark:border-slate-800">
            {Icon && <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><Icon size={16} /></span>}
            <div className="min-w-0 flex-1">
                <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
                <dd className="mt-1 break-words text-sm font-medium text-slate-800 dark:text-slate-100">{value || '—'}</dd>
            </div>
        </div>
    );
}

export default function StudentDetailsDialog({ student, onClose, onEdit }) {
    const { t } = useLanguage();
    const [details, setDetails] = useState(student || null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const requestSequenceRef = useRef(0);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    const loadDetails = useCallback(async () => {
        const requestSequence = ++requestSequenceRef.current;
        if (!student?.id) {
            setError(t('studentDetailsUnavailable'));
            setLoading(false);
            return;
        }

        setDetails(student);
        setLoading(true);
        setError('');
        try {
            const result = await getStudentById(student.id);
            if (requestSequence === requestSequenceRef.current) {
                setDetails(result?.data || result);
            }
        } catch (requestError) {
            if (requestSequence === requestSequenceRef.current) {
                setError(requestError.response?.data?.message || t('studentDetailsLoadFailed'));
            }
        } finally {
            if (requestSequence === requestSequenceRef.current) setLoading(false);
        }
    }, [student, t]);

    useEffect(() => {
        void loadDetails();
        const handleKeyDown = event => {
            if (event.key === 'Escape') onCloseRef.current?.();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            ++requestSequenceRef.current;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [loadDetails]);

    const display = details || student || {};
    const fullName = display.name || t('noData');
    const className = [display.class_code, display.class_name].filter(Boolean).join(' — ') || (display.class_id ? String(display.class_id) : '—');

    return (
        <div
            className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/45 p-3 sm:p-5"
            onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="student-details-title"
                className="max-h-[min(90vh,760px)] w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
            >
                <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"><GraduationCap size={22} /></span>
                        <div className="min-w-0">
                            <p className="text-xs text-slate-500 dark:text-slate-400">{t('studentManagement')}</p>
                            <h2 id="student-details-title" className="mt-1 truncate text-lg font-semibold text-slate-900 dark:text-white">{t('studentDetailsTitle')}</h2>
                            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{display.student_code || '—'} · {fullName}</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="flex size-9 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white" aria-label={t('close')} title={t('close')}><X size={18} /></button>
                </header>

                <div className="max-h-[calc(90vh-145px)] overflow-y-auto px-5 py-4 sm:px-6">
                    {loading && (
                        <div role="status" aria-live="polite" className="space-y-3 py-3">
                            <div className="h-4 w-2/5 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                            <div className="h-14 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                            <div className="h-14 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                            <p className="text-xs text-slate-500 dark:text-slate-400">{t('loadingStudentsData')}</p>
                        </div>
                    )}

                    {!loading && error && (
                        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/70 dark:bg-rose-950/30">
                            <p className="text-sm font-medium text-rose-800 dark:text-rose-200">{error}</p>
                            <button type="button" onClick={loadDetails} className="mt-3 inline-flex items-center gap-2 rounded-md border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-300"><RefreshCw size={14} />{t('retry')}</button>
                        </div>
                    )}

                    {!loading && !error && (
                        <div className="grid gap-4 sm:grid-cols-2">
                            <section className="min-w-0 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t('studentPersonalInformation')}</h3>
                                <dl className="mt-2">
                                    <DetailRow label={t('studentCodeShort')} value={display.student_code} icon={UserRound} />
                                    <DetailRow label={t('studentName')} value={display.name} />
                                    <DetailRow label={t('email')} value={display.email} icon={Mail} />
                                    <DetailRow label={t('dateOfBirthShort')} value={display.date_of_birth} icon={CalendarDays} />
                                    <DetailRow label={t('gender')} value={display.gender} />
                                </dl>
                            </section>
                            <section className="min-w-0 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t('studentAcademicInformation')}</h3>
                                <dl className="mt-2">
                                    <DetailRow label={t('className')} value={className} icon={GraduationCap} />
                                </dl>
                                <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">{t('studentDetailsAvailableFieldsNote')}</p>
                            </section>
                        </div>
                    )}
                </div>

                <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800 sm:px-6">
                    {onEdit && !loading && !error && <button type="button" onClick={() => { onClose?.(); onEdit(details || student); }} className="rounded-md bg-[#174a7e] px-4 py-2 text-xs font-semibold text-white hover:bg-[#123b66]">{t('edit')}</button>}
                    <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">{t('close')}</button>
                </footer>
            </section>
        </div>
    );
}
