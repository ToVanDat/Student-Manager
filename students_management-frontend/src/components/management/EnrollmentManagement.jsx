import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/api/client.js';
import { useLanguage } from '@/context/LanguageContext.jsx';

const EMPTY = { student_id: '', subject_id: '', semester_id: '', midterm_score: '', final_score: '', total_score: '' };
const SCORE_FIELDS = ['midterm_score', 'final_score', 'total_score'];

export default function EnrollmentManagement() {
    const { t } = useLanguage();
    const [items, setItems] = useState([]);
    const [students, setStudents] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [semesters, setSemesters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY);
    const [formOpen, setFormOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [enrollmentResult, studentResult, subjectResult, semesterResult] = await Promise.all([
                apiClient.get('/api/enrollments'),
                apiClient.get('/api/students'),
                apiClient.get('/api/subjects'),
                apiClient.get('/api/semesters')
            ]);
            setItems(Array.isArray(enrollmentResult.data) ? enrollmentResult.data : []);
            setStudents(Array.isArray(studentResult.data) ? studentResult.data : []);
            setSubjects(Array.isArray(subjectResult.data) ? subjectResult.data : []);
            setSemesters(Array.isArray(semesterResult.data) ? semesterResult.data : []);
        } catch (err) {
            setError(err?.response?.data?.message || t('enrollmentLoadFailed'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => { void loadData(); }, [loadData]);

    const visibleItems = useMemo(() => {
        const term = query.trim().toLocaleLowerCase();
        return term ? items.filter(item => [
            item.student_code, item.student_name, item.subject_code, item.subject_name, item.semester_name, item.academic_year
        ].some(value => String(value ?? '').toLocaleLowerCase().includes(term))) : items;
    }, [items, query]);

    const startForm = item => {
        setEditing(item || null);
        setForm(item ? {
            student_id: String(item.student_id ?? ''),
            subject_id: String(item.subject_id ?? ''),
            semester_id: String(item.semester_id ?? ''),
            midterm_score: item.midterm_score == null ? '' : String(item.midterm_score),
            final_score: item.final_score == null ? '' : String(item.final_score),
            total_score: item.total_score == null ? '' : String(item.total_score)
        } : EMPTY);
        setFormError('');
        setFormOpen(true);
    };

    const closeForm = () => {
        if (saving) return;
        setFormOpen(false);
        setEditing(null);
        setFormError('');
    };

    const submit = async event => {
        event.preventDefault();
        if (saving) return;
        const validStudent = students.some(item => String(item.id) === String(form.student_id));
        const validSubject = subjects.some(item => String(item.id) === String(form.subject_id));
        const validSemester = semesters.some(item => String(item.id) === String(form.semester_id));
        if (!validStudent || !validSubject || !validSemester) {
            setFormError(t('enrollmentFieldsRequired'));
            return;
        }
        for (const field of SCORE_FIELDS) {
            if (form[field] !== '' && !Number.isFinite(Number(form[field]))) {
                setFormError(t('scoreMustBeNumber'));
                return;
            }
        }
        const payload = {
            student_id: Number(form.student_id),
            subject_id: Number(form.subject_id),
            semester_id: Number(form.semester_id),
            ...Object.fromEntries(SCORE_FIELDS.map(field => [field, form[field] === '' ? null : Number(form[field])]))
        };
        setSaving(true);
        setFormError('');
        try {
            if (editing) {
                await apiClient.patch(`/api/enrollments/${editing.id}`, payload);
                toast.success(t('enrollmentUpdated'));
            } else {
                await apiClient.post('/api/enrollments', payload);
                toast.success(t('enrollmentCreated'));
            }
            setFormOpen(false);
            setEditing(null);
            await loadData();
        } catch (err) {
            const message = err?.response?.data?.message || t('enrollmentSaveFailed');
            setFormError(message);
            toast.error(message);
        } finally {
            setSaving(false);
        }
    };

    const remove = async item => {
        if (!window.confirm(t('confirmDeleteEnrollment', { name: item.student_name || item.student_code, subject: item.subject_name || item.subject_code }))) return;
        try {
            await apiClient.delete(`/api/enrollments/${item.id}`);
            toast.success(t('enrollmentDeleted'));
            await loadData();
        } catch (err) {
            toast.error(err?.response?.data?.message || t('enrollmentDeleteFailed'));
        }
    };

    return (
        <section className="mx-auto max-w-7xl space-y-5">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div><h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('enrollments')}</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('enrollmentManagementDescription')}</p></div>
                <button type="button" onClick={() => startForm(null)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={16} />{t('addEnrollment')}</button>
            </header>
            <div className="app-card overflow-hidden">
                <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                    <div><h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t('enrollmentDirectory')}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('catalogCount', { count: items.length })}</p></div>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 dark:border-slate-700 sm:w-80"><Search size={16} className="text-slate-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('searchEnrollments')} aria-label={t('searchEnrollments')} className="min-w-0 flex-1 border-0 bg-transparent py-2.5 text-sm outline-none focus:ring-0 dark:text-white" /></div>
                </div>
                {loading ? <div role="status" className="space-y-3 p-5"><div className="h-10 animate-pulse rounded bg-slate-100 dark:bg-slate-800" /><div className="h-10 animate-pulse rounded bg-slate-100 dark:bg-slate-800" /><p className="text-xs text-slate-500">{t('loading')}</p></div>
                    : error ? <div role="alert" className="p-8 text-center"><p className="text-sm text-rose-700 dark:text-rose-300">{error}</p><button type="button" onClick={() => void loadData()} className="mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm dark:border-slate-700"><RefreshCw size={14} />{t('retry')}</button></div>
                        : visibleItems.length === 0 ? <div className="p-12 text-center"><BookOpen className="mx-auto text-slate-400" size={24} /><p className="mt-3 text-sm font-semibold text-slate-800 dark:text-white">{query ? t('enrollmentNoMatches') : t('enrollmentEmpty')}</p></div>
                            : <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-300"><tr>{['studentLabel', 'subjectLabel', 'semesterLabel', 'midtermScoreLabel', 'finalScoreLabel', 'totalScoreLabel'].map(key => <th key={key} className="px-4 py-3">{t(key)}</th>)}<th className="px-4 py-3 text-right">{t('actions')}</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{visibleItems.map(item => <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50"><td className="px-4 py-4"><div className="font-medium text-slate-900 dark:text-white">{item.student_name || '—'}</div><div className="mt-1 text-xs text-slate-400">{item.student_code || '—'}</div></td><td className="px-4 py-4"><div className="font-medium text-slate-800 dark:text-slate-100">{item.subject_name || '—'}</div><div className="mt-1 text-xs text-slate-400">{item.subject_code || '—'}</div></td><td className="px-4 py-4">{item.semester_name || '—'}<div className="mt-1 text-xs text-slate-400">{item.academic_year || ''}</div></td>{SCORE_FIELDS.map(field => <td key={field} className="px-4 py-4 tabular-nums">{item[field] ?? '—'}</td>)}<td className="px-4 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => startForm(item)} aria-label={t('update')} title={t('update')} className="rounded-lg border p-2 text-slate-600 hover:bg-blue-50 dark:border-slate-700 dark:text-slate-300"><Pencil size={15} /></button><button type="button" onClick={() => void remove(item)} aria-label={t('delete')} title={t('delete')} className="rounded-lg border p-2 text-rose-600 hover:bg-rose-50 dark:border-slate-700 dark:text-rose-300"><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div>}
            </div>
            {formOpen && <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/50 p-3" onMouseDown={event => { if (event.target === event.currentTarget) closeForm(); }}><section role="dialog" aria-modal="true" aria-labelledby="enrollment-form-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"><header className="flex items-start justify-between border-b p-5 dark:border-slate-800"><div><h2 id="enrollment-form-title" className="font-bold text-slate-900 dark:text-white">{editing ? t('editEnrollment') : t('addEnrollment')}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('enrollmentFormDescription')}</p></div><button type="button" onClick={closeForm} disabled={saving} aria-label={t('close')}><X size={18} /></button></header><form onSubmit={submit} className="space-y-4 p-5">{[{name:'student_id',label:'studentLabel',options:students.map(item=>({id:item.id,label:`${item.student_code} — ${item.name}`}))},{name:'subject_id',label:'subjectLabel',options:subjects.map(item=>({id:item.id,label:`${item.subject_code} — ${item.subject_name}`}))},{name:'semester_id',label:'semesterLabel',options:semesters.map(item=>({id:item.id,label:`${item.semester_name} — ${item.academic_year}`}))}].map(field=><div key={field.name}><label htmlFor={`enrollment-${field.name}`} className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">{t(field.label)}</label><select id={`enrollment-${field.name}`} required value={form[field.name]} onChange={event=>setForm(previous=>({...previous,[field.name]:event.target.value}))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="">{t(`select${field.label[0].toUpperCase()}${field.label.slice(1)}`)}</option>{field.options.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></div>)}<div className="grid gap-3 sm:grid-cols-3">{SCORE_FIELDS.map((field,index)=><div key={field}><label htmlFor={field} className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">{t(['midtermScoreLabel','finalScoreLabel','totalScoreLabel'][index])}</label><input id={field} type="number" step="any" value={form[field]} onChange={event=>setForm(previous=>({...previous,[field]:event.target.value}))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></div>)}</div>{formError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">{formError}</p>}<div className="flex justify-end gap-2 border-t pt-4 dark:border-slate-800"><button type="button" onClick={closeForm} disabled={saving} className="rounded-lg border px-4 py-2 text-sm dark:border-slate-700">{t('cancel')}</button><button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? t('saving') : t('save')}</button></div></form></section></div>}
        </section>
    );
}
