import { useCallback, useEffect, useState } from 'react';
import { FileUp, RefreshCw, LoaderCircle, BookOpen } from 'lucide-react';
import { listAssistantDocuments, uploadAssistantDocument } from '@/api/chatbotApi.js';

export default function AssistantKnowledgeManager({ language = 'vi' }) {
    const vi = language === 'vi';
    const [documents, setDocuments] = useState([]);
    const [file, setFile] = useState(null);
    const [title, setTitle] = useState('');
    const [visibility, setVisibility] = useState('all');
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const result = await listAssistantDocuments();
            setDocuments(Array.isArray(result.documents) ? result.documents : []);
        } catch (err) {
            setError(err?.response?.data?.message || (vi ? 'Không thể tải danh sách tài liệu.' : 'Could not load documents.'));
        } finally {
            setLoading(false);
        }
    }, [vi]);

    useEffect(() => { void load(); }, [load]);

    const submit = async event => {
        event.preventDefault();
        if (!file || uploading) return;
        setUploading(true);
        setError('');
        setNotice('');
        try {
            const result = await uploadAssistantDocument({
                file,
                title: title.trim() || file.name.replace(/\.txt$/i, ''),
                visibility
            });
            setNotice(vi
                ? `Đã nạp tài liệu “${result.document.title}” với ${result.document.chunkCount} đoạn.`
                : `Indexed “${result.document.title}” with ${result.document.chunkCount} chunks.`);
            setFile(null);
            setTitle('');
            await load();
        } catch (err) {
            setError(err?.response?.data?.message || (vi ? 'Không thể nạp tài liệu.' : 'Document ingestion failed.'));
        } finally {
            setUploading(false);
        }
    };

    return (
        <section className="border-b border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <BookOpen size={16} />{vi ? 'Kho tri thức tài liệu' : 'Document knowledge base'}
                </div>
                <button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg p-2 text-slate-500 hover:bg-white disabled:opacity-50 dark:hover:bg-slate-800" aria-label={vi ? 'Tải lại' : 'Refresh'}>
                    {loading ? <LoaderCircle size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                </button>
            </div>
            <form onSubmit={submit} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <input key={file ? file.name : "empty"} type="file" accept=".txt,text/plain" onChange={event => setFile(event.target.files?.[0] || null)} className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-blue-700 dark:text-slate-300 dark:file:bg-blue-950 dark:file:text-blue-300" />
                <input value={title} onChange={event => setTitle(event.target.value)} maxLength={200} placeholder={vi ? 'Tên hiển thị tài liệu (không bắt buộc)' : 'Document title (optional)'} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                <div className="flex items-center gap-2">
                    <select value={visibility} onChange={event => setVisibility(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                        <option value="all">{vi ? 'Tất cả người dùng' : 'All users'}</option>
                        <option value="student">{vi ? 'Chỉ sinh viên' : 'Students only'}</option>
                        <option value="admin">{vi ? 'Chỉ quản trị viên' : 'Admins only'}</option>
                    </select>
                    <button type="submit" disabled={!file || uploading} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40">
                        {uploading ? <LoaderCircle size={14} className="animate-spin" /> : <FileUp size={14} />}
                        {vi ? 'Nạp TXT' : 'Index TXT'}
                    </button>
                </div>
                <p className="m-0 text-[10px] leading-4 text-slate-400">{vi ? 'Chỉ TXT UTF-8, tối đa 1 MB. Tài liệu được lưu trong PostgreSQL; nội dung được dùng làm dữ liệu tham khảo, không phải chỉ thị.' : 'UTF-8 TXT only, up to 1 MB. Stored in PostgreSQL; document text is untrusted reference data, never instructions.'}</p>
            </form>
            {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
            {notice && <p role="status" className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">{notice}</p>}
            <div className="mt-3 space-y-1.5">
                {documents.map(document => (
                    <div key={document.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs dark:bg-slate-900">
                        <div className="min-w-0">
                            <p className="m-0 truncate font-medium text-slate-700 dark:text-slate-200">{document.title}</p>
                            <p className="m-0 truncate text-[10px] text-slate-400">{document.source_name} · {document.visibility}</p>
                        </div>
                        <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${document.status === 'ready' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>{document.status}</span>
                    </div>
                ))}
                {!loading && documents.length === 0 && <p className="m-0 py-2 text-center text-xs text-slate-400">{vi ? 'Chưa có tài liệu nào.' : 'No documents indexed yet.'}</p>}
            </div>
        </section>
    );
}
