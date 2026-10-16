import { useCallback, useEffect, useMemo, useState } from 'react';
import { Layers, Plus, Pencil, Trash2, Search, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/api/client.js';
import { useLanguage } from '@/context/LanguageContext.jsx';

const EMPTY = { class_code: '', class_name: '', department_id: '' };

export default function ClassManagement() {
    const { t } = useLanguage();
    const [classes, setClasses] = useState([]);
    const [departments, setDepartments] = useState([]);
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
            const [classResult, departmentResult] = await Promise.all([
                apiClient.get('/api/classes'),
                apiClient.get('/api/departments')
            ]);
            setClasses(Array.isArray(classResult.data) ? classResult.data : []);
            setDepartments(Array.isArray(departmentResult.data) ? departmentResult.data : []);
        } catch (err) {
            setError(err?.response?.data?.message || t('classesLoadFailed'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => { void loadData(); }, [loadData]);

    const visibleClasses = useMemo(() => {
        const term = query.trim().toLocaleLowerCase();
        return term ? classes.filter(item => [item.class_code, item.class_name, item.department_code, item.department_name]
            .some(value => String(value || '').toLocaleLowerCase().includes(term))) : classes;
    }, [classes, query]);

    const startCreate = () => {
        setEditing(null);
        setForm(EMPTY);
        setFormError('');
        setFormOpen(true);
    };

    const startEdit = item => {
        setEditing(item);
        setForm({ class_code: item.class_code || '', class_name: item.class_name || '', department_id: String(item.department_id || '') });
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
        const departmentId = Number(form.department_id);
        if (!form.class_code.trim() || !form.class_name.trim() || !form.department_id) {
            setFormError(t('classFieldsRequired'));
            return;
        }
        if (!Number.isSafeInteger(departmentId) || !departments.some(item => Number(item.id) === departmentId)) {
            setFormError(t('selectDepartment'));
            return;
        }
        setSaving(true);
        setFormError('');
        try {
            const payload = { class_code: form.class_code.trim(), class_name: form.class_name.trim(), department_id: departmentId };
            if (editing) {
                await apiClient.patch(`/api/classes/${editing.id}`, payload);
                toast.success(t('classUpdated'));
            } else {
                await apiClient.post('/api/classes', payload);
                toast.success(t('classCreated'));
            }
            setFormOpen(false);
            setEditing(null);
            await loadData();
        } catch (err) {
            const message = err?.response?.data?.message || t('classSaveFailed');
            setFormError(message);
            toast.error(message);
        } finally {
            setSaving(false);
        }
    };

    const remove = async item => {
        if (!window.confirm(t('confirmDeleteClass', { name: item.class_name || item.class_code }))) return;
        try {
            await apiClient.delete(`/api/classes/${item.id}`);
            toast.success(t('classDeleted'));
            await loadData();
        } catch (err) {
            toast.error(err?.response?.data?.message || t('classDeleteFailed'));
        }
    };

    return (
        <section className="mx-auto max-w-7xl space-y-5">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-200"><Layers size={14} />{t('trainingGroup')}</p>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('classes')}</h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('moduleClassesDescription')}</p>
                </div>
                <button type="button" onClick={startCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={16} />{t('addClass')}</button>
            </header>

            <div className="app-card overflow-hidden">
                <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                    <div><h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t('classDirectory')}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('classCount', { count: classes.length })}</p></div>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 dark:border-slate-700 sm:w-80"><Search size={16} className="text-slate-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('searchClasses')} aria-label={t('searchClasses')} className="min-w-0 flex-1 border-0 bg-transparent py-2.5 text-sm outline-none focus:ring-0 dark:text-white" />{query && <button type="button" onClick={() => setQuery('')} aria-label={t('clearSearch')}><X size={14} /></button>}</div>
                </div>
                {loading ? <div role="status" className="space-y-3 p-5"><div className="h-10 animate-pulse rounded bg-slate-100 dark:bg-slate-800" /><div className="h-10 animate-pulse rounded bg-slate-100 dark:bg-slate-800" /><p className="text-xs text-slate-500">{t('loading')}</p></div>
                    : error ? <div role="alert" className="p-8 text-center"><p className="text-sm text-rose-700 dark:text-rose-300">{error}</p><button type="button" onClick={() => void loadData()} className="mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm dark:border-slate-700"><RefreshCw size={14} />{t('retry')}</button></div>
                        : visibleClasses.length === 0 ? <div className="p-12 text-center"><p className="text-sm font-semibold text-slate-800 dark:text-white">{query ? t('noClassMatches') : t('noClassesAvailable')}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{query ? t('changeSearchHint') : t('classEmptyHint')}</p></div>
                            : <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-300"><tr><th className="px-5 py-3">{t('classCodeLabel')}</th><th className="px-5 py-3">{t('className')}</th><th className="px-5 py-3">{t('department')}</th><th className="px-5 py-3 text-right">{t('actions')}</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{visibleClasses.map(item => <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50"><td className="px-5 py-4 font-mono text-xs font-semibold text-blue-700 dark:text-blue-300">{item.class_code}</td><td className="px-5 py-4 font-medium text-slate-900 dark:text-white">{item.class_name}</td><td className="px-5 py-4"><div className="text-slate-700 dark:text-slate-200">{item.department_name || '—'}</div><div className="mt-1 text-xs text-slate-400">{item.department_code || '—'}</div></td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => startEdit(item)} title={t('editClass')} aria-label={t('editClass')} className="rounded-lg border p-2 text-slate-600 hover:bg-blue-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"><Pencil size={15} /></button><button type="button" onClick={() => void remove(item)} title={t('deleteClass')} aria-label={t('deleteClass')} className="rounded-lg border p-2 text-rose-600 hover:bg-rose-50 dark:border-slate-700 dark:text-rose-300 dark:hover:bg-rose-950/30"><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div>}
            </div>

            {formOpen && <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/50 p-3" onMouseDown={event => { if (event.target === event.currentTarget) closeForm(); }}><section role="dialog" aria-modal="true" aria-labelledby="class-form-title" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"><header className="flex items-start justify-between border-b p-5 dark:border-slate-800"><div><h2 id="class-form-title" className="font-bold text-slate-900 dark:text-white">{editing ? t('editClass') : t('addClass')}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('classFormDescription')}</p></div><button type="button" onClick={closeForm} disabled={saving} aria-label={t('close')}><X size={18} /></button></header><form onSubmit={submit} className="space-y-4 p-5"><div><label htmlFor="class-code" className="mb-1 block text-xs font-semibold">{t('classCodeLabel')}</label><input id="class-code" required value={form.class_code} onChange={event => setForm(previous => ({ ...previous, class_code: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950" /></div><div><label htmlFor="class-name" className="mb-1 block text-xs font-semibold">{t('className')}</label><input id="class-name" required value={form.class_name} onChange={event => setForm(previous => ({ ...previous, class_name: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950" /></div><div><label htmlFor="class-department" className="mb-1 block text-xs font-semibold">{t('department')}</label><select id="class-department" required value={form.department_id} onChange={event => setForm(previous => ({ ...previous, department_id: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="">{t('selectDepartment')}</option>{departments.map(item => <option key={item.id} value={item.id}>{item.department_code} — {item.department_name}</option>)}</select></div>{formError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">{formError}</p>}<div className="flex justify-end gap-2 border-t pt-4 dark:border-slate-800"><button type="button" onClick={closeForm} disabled={saving} className="rounded-lg border px-4 py-2 text-sm dark:border-slate-700">{t('cancel')}</button><button type="submit" disabled={saving || departments.length === 0} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? t('saving') : t('save')}</button></div></form></section></div>}
        </section>
    );
}
