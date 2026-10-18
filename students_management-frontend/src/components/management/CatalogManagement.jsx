import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/api/client.js';
import { useLanguage } from '@/context/LanguageContext.jsx';

const CONFIG = {
    departments: {
        endpoint: '/api/departments', titleKey: 'departments', entityKey: 'departmentEntity', codeKey: 'department_code', nameKey: 'department_name',
        fields: [{ name: 'department_code', label: 'departmentCodeLabel' }, { name: 'department_name', label: 'departmentNameLabel' }]
    },
    subjects: {
        endpoint: '/api/subjects', titleKey: 'subjects', entityKey: 'subjectEntity', codeKey: 'subject_code', nameKey: 'subject_name',
        fields: [{ name: 'subject_code', label: 'subjectCodeLabel' }, { name: 'subject_name', label: 'subjectNameLabel' }, { name: 'credits', label: 'creditsLabel', type: 'number' }]
    },
    semesters: {
        endpoint: '/api/semesters', titleKey: 'semesters', entityKey: 'semesterEntity', nameKey: 'semester_name',
        fields: [{ name: 'semester_name', label: 'semesterNameLabel' }, { name: 'academic_year', label: 'academicYearLabel' }]
    }
};

export default function CatalogManagement({ resource }) {
    const { t } = useLanguage();
    const config = CONFIG[resource];
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({});
    const [formOpen, setFormOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    const loadItems = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await apiClient.get(config.endpoint);
            setItems(Array.isArray(response.data) ? response.data : []);
        } catch (err) {
            setError(err?.response?.data?.message || t('catalogLoadFailed'));
        } finally {
            setLoading(false);
        }
    }, [config.endpoint, t]);

    useEffect(() => { void loadItems(); }, [loadItems]);

    const visibleItems = useMemo(() => {
        const term = query.trim().toLocaleLowerCase();
        return term ? items.filter(item => config.fields.some(field => String(item[field.name] ?? '').toLocaleLowerCase().includes(term))) : items;
    }, [items, query, config.fields]);

    const startForm = item => {
        setEditing(item || null);
        setForm(Object.fromEntries(config.fields.map(field => [field.name, item?.[field.name] == null ? '' : String(item[field.name])])));
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
        if (config.fields.some(field => String(form[field.name] ?? '').trim() === '')) {
            setFormError(t('catalogFieldsRequired'));
            return;
        }
        if (resource === 'subjects' && (!Number.isSafeInteger(Number(form.credits)) || Number(form.credits) <= 0)) {
            setFormError(t('creditsMustBePositive'));
            return;
        }
        const payload = Object.fromEntries(config.fields.map(field => [
            field.name,
            field.type === 'number' ? Number(form[field.name]) : String(form[field.name]).trim()
        ]));
        setSaving(true);
        setFormError('');
        try {
            if (editing) {
                await apiClient.patch(`${config.endpoint}/${editing.id}`, payload);
                toast.success(t('catalogUpdated'));
            } else {
                await apiClient.post(config.endpoint, payload);
                toast.success(t('catalogCreated'));
            }
            setFormOpen(false);
            setEditing(null);
            await loadItems();
        } catch (err) {
            const message = err?.response?.data?.message || t('catalogSaveFailed');
            setFormError(message);
            toast.error(message);
        } finally {
            setSaving(false);
        }
    };

    const remove = async item => {
        const displayName = item[config.nameKey] || item[config.codeKey] || item.id;
        if (!window.confirm(t('confirmDeleteCatalog', { name: displayName }))) return;
        try {
            await apiClient.delete(`${config.endpoint}/${item.id}`);
            toast.success(t('catalogDeleted'));
            await loadItems();
        } catch (err) {
            toast.error(err?.response?.data?.message || t('catalogDeleteFailed'));
        }
    };

    return (
        <section className="mx-auto max-w-7xl space-y-5">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div><h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t(config.titleKey)}</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('catalogPageDescription')}</p></div>
                <button type="button" onClick={() => startForm(null)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={16} />{t('create')} {t(config.entityKey)}</button>
            </header>
            <div className="app-card overflow-hidden">
                <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                    <div><h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t('catalogDirectory')}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('catalogCount', { count: items.length })}</p></div>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 dark:border-slate-700 sm:w-80"><Search size={16} className="text-slate-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('catalogSearchPlaceholder')} aria-label={t('catalogSearchPlaceholder')} className="min-w-0 flex-1 border-0 bg-transparent py-2.5 text-sm outline-none focus:ring-0 dark:text-white" /></div>
                </div>
                {loading ? <div role="status" className="space-y-3 p-5"><div className="h-10 animate-pulse rounded bg-slate-100 dark:bg-slate-800" /><div className="h-10 animate-pulse rounded bg-slate-100 dark:bg-slate-800" /><p className="text-xs text-slate-500">{t('loading')}</p></div>
                    : error ? <div role="alert" className="p-8 text-center"><p className="text-sm text-rose-700 dark:text-rose-300">{error}</p><button type="button" onClick={() => void loadItems()} className="mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm dark:border-slate-700"><RefreshCw size={14} />{t('retry')}</button></div>
                        : visibleItems.length === 0 ? <div className="p-12 text-center"><p className="text-sm font-semibold text-slate-800 dark:text-white">{query ? t('catalogNoMatches') : t('catalogEmpty')}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{query ? t('changeSearchHint') : t('catalogEmptyHint')}</p></div>
                            : <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-300"><tr>{config.fields.map(field => <th key={field.name} className="px-5 py-3">{t(field.label)}</th>)}<th className="px-5 py-3 text-right">{t('actions')}</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{visibleItems.map(item => <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">{config.fields.map(field => <td key={field.name} className="px-5 py-4 text-slate-800 dark:text-slate-100">{item[field.name] ?? '—'}</td>)}<td className="px-5 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => startForm(item)} aria-label={t('update')} title={t('update')} className="rounded-lg border p-2 text-slate-600 hover:bg-blue-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"><Pencil size={15} /></button><button type="button" onClick={() => void remove(item)} aria-label={t('delete')} title={t('delete')} className="rounded-lg border p-2 text-rose-600 hover:bg-rose-50 dark:border-slate-700 dark:text-rose-300"><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div>}
            </div>
            {formOpen && <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/50 p-3" onMouseDown={event => { if (event.target === event.currentTarget) closeForm(); }}><section role="dialog" aria-modal="true" aria-labelledby="catalog-form-title" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"><header className="flex items-start justify-between border-b p-5 dark:border-slate-800"><div><h2 id="catalog-form-title" className="font-bold text-slate-900 dark:text-white">{editing ? t('update') : t('create')} {t(config.entityKey)}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('catalogFormDescription')}</p></div><button type="button" onClick={closeForm} disabled={saving} aria-label={t('close')}><X size={18} /></button></header><form onSubmit={submit} className="space-y-4 p-5">{config.fields.map(field => <div key={field.name}><label htmlFor={`catalog-${field.name}`} className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">{t(field.label)}</label><input id={`catalog-${field.name}`} type={field.type || 'text'} min={field.type === 'number' ? 1 : undefined} step={field.type === 'number' ? 1 : undefined} required value={form[field.name] || ''} onChange={event => setForm(previous => ({ ...previous, [field.name]: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></div>)}{formError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">{formError}</p>}<div className="flex justify-end gap-2 border-t pt-4 dark:border-slate-800"><button type="button" onClick={closeForm} disabled={saving} className="rounded-lg border px-4 py-2 text-sm dark:border-slate-700">{t('cancel')}</button><button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? t('saving') : t('save')}</button></div></form></section></div>}
        </section>
    );
}
