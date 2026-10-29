import { useEffect, useRef, useState } from 'react';
import { FileUp, LoaderCircle, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext.jsx';
import { confirmStudentCsvImport, previewStudentCsvImport } from '@/api/studentApi.js';

function StudentCsvImportDialog({ onClose, onImported }) {
    const { t } = useLanguage();
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [previewing, setPreviewing] = useState(false);
    const [importing, setImporting] = useState(false);
    const dialogRef = useRef(null);
    const closeButtonRef = useRef(null);
    const busyRef = useRef(false);
    busyRef.current = previewing || importing;

    useEffect(() => {
        const previouslyFocused = document.activeElement;
        closeButtonRef.current?.focus();
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                if (!busyRef.current) {
                    event.preventDefault();
                    onClose?.();
                }
                return;
            }
            if (event.key !== 'Tab') return;
            const focusable = dialogRef.current?.querySelectorAll(
                'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
            );
            if (!focusable?.length) {
                event.preventDefault();
                dialogRef.current?.focus();
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            if (previouslyFocused?.isConnected) previouslyFocused.focus();
        };
    }, [onClose]);

    const selectFile = (nextFile) => {
        setFile(nextFile || null);
        setPreview(null);
    };

    const handlePreview = async () => {
        if (!file || previewing || importing) return;
        setPreviewing(true);
        try {
            const result = await previewStudentCsvImport(file);
            setPreview(result);
        } catch (error) {
            setPreview(null);
            toast.error(error?.response?.data?.message || t('studentImportFailed'));
        } finally {
            setPreviewing(false);
        }
    };

    const handleConfirm = async () => {
        if (!file || !preview || preview.invalidCount > 0 || preview.validCount < 1 || importing) return;
        setImporting(true);
        try {
            const result = await confirmStudentCsvImport(file);
            toast.success(t('studentImportSuccess', { count: result.importedCount }));
            onImported?.();
            onClose?.();
        } catch (error) {
            const payload = error?.response?.data;
            if (payload?.preview) setPreview(payload.preview);
            toast.error(payload?.message || t('studentImportFailed'));
        } finally {
            setImporting(false);
        }
    };

    const displayedRows = preview?.rows?.slice(0, 12) || [];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !previewing && !importing) onClose?.();
        }}>
            <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="student-csv-import-title" tabIndex={-1} className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
                    <div className="flex items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"><FileUp size={20} /></span>
                        <div>
                            <h2 id="student-csv-import-title" className="m-0 text-base font-bold text-slate-900 dark:text-white">{t('studentImportTitle')}</h2>
                            <p className="mb-0 mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{t('studentImportDescription')}</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} disabled={previewing || importing} aria-label={t('close')} ref={closeButtonRef} className="flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"><X size={18} /></button>
                </header>

                <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/40">
                        <label className="flex cursor-pointer flex-col items-center gap-2 text-center">
                            <Upload size={22} className="text-slate-500" />
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{file?.name || t('studentImportSelectFile')}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">{t('studentImportFileLimit')}</span>
                            <input type="file" accept=".csv,text/csv" className="sr-only" disabled={previewing || importing} onChange={(event) => { selectFile(event.target.files?.[0]); event.currentTarget.value = ''; }} />
                        </label>
                        <p className="mb-0 mt-3 text-[11px] leading-5 text-slate-500 dark:text-slate-400">{t('studentImportTemplateHint')}</p>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                        <button type="button" onClick={handlePreview} disabled={!file || previewing || importing} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-700 px-4 text-xs font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
                            {previewing && <LoaderCircle size={15} className="animate-spin" />}
                            {previewing ? t('studentImportWorking') : t('studentImportPreview')}
                        </button>
                    </div>

                    {preview && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800"><p className="mb-1 text-[11px] text-slate-500 dark:text-slate-400">{t('studentImportTotalRows')}</p><p className="m-0 text-xl font-bold tabular-nums text-slate-900 dark:text-white">{preview.totalRows}</p></div>
                                <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30"><p className="mb-1 text-[11px] text-emerald-700 dark:text-emerald-300">{t('studentImportValidRows')}</p><p className="m-0 text-xl font-bold tabular-nums text-emerald-800 dark:text-emerald-200">{preview.validCount}</p></div>
                                <div className="rounded-xl bg-rose-50 p-3 dark:bg-rose-950/30"><p className="mb-1 text-[11px] text-rose-700 dark:text-rose-300">{t('studentImportInvalidRows')}</p><p className="m-0 text-xl font-bold tabular-nums text-rose-800 dark:text-rose-200">{preview.invalidCount}</p></div>
                            </div>

                            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                                <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-700">
                                    <p className="m-0 text-xs font-semibold text-slate-700 dark:text-slate-200">{t('studentImportPreviewRows')}</p>
                                    <span className="text-[11px] text-slate-500">{Math.min(preview.rows.length, 12)} / {preview.rows.length}</span>
                                </div>
                                <div className="max-h-64 overflow-auto">
                                    <table className="w-full min-w-[620px] border-collapse text-left text-xs">
                                        <thead className="sticky top-0 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                            <tr>
                                                <th className="px-3 py-2">{t('studentImportRow')}</th>
                                                <th className="px-3 py-2">{t('studentImportCode')}</th>
                                                <th className="px-3 py-2">{t('studentImportName')}</th>
                                                <th className="px-3 py-2">{t('studentImportClass')}</th>
                                                <th className="px-3 py-2">{t('studentImportIssues')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {displayedRows.map((row) => (
                                                <tr key={row.rowNumber} className="border-t border-slate-100 align-top dark:border-slate-800">
                                                    <td className="px-3 py-2 tabular-nums text-slate-500">{row.rowNumber}</td>
                                                    <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">{row.student_code || '—'}</td>
                                                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{row.name || '—'}</td>
                                                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{row.class_code || '—'}</td>
                                                    <td className="px-3 py-2">{row.errors.length ? <ul className="m-0 list-disc space-y-1 pl-4 text-rose-600 dark:text-rose-300">{row.errors.map((issue, index) => <li key={index}>{issue}</li>)}</ul> : <span className="font-medium text-emerald-700 dark:text-emerald-300">OK</span>}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {preview.rows.length > 12 && <p className="m-0 border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500 dark:border-slate-800">{t('studentImportMoreRows', { count: preview.rows.length - 12 })}</p>}
                            </div>
                            {preview.invalidCount > 0 && <p className="m-0 rounded-lg bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{t('studentImportFixErrors')}</p>}
                        </div>
                    )}
                </div>

                <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
                    <button type="button" onClick={onClose} disabled={previewing || importing} className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{t('studentImportCancel')}</button>
                    <button type="button" onClick={handleConfirm} disabled={!preview || preview.invalidCount > 0 || preview.validCount < 1 || importing || previewing} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-45">
                        {importing && <LoaderCircle size={15} className="animate-spin" />}
                        {importing ? t('studentImportWorking') : t('studentImportConfirm')}
                    </button>
                </footer>
            </section>
        </div>
    );
}

export default StudentCsvImportDialog;
