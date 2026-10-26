import { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, BookOpen, CheckCircle2, FileText, FileUp, LoaderCircle, RefreshCw, ShieldCheck, UploadCloud, Undo2 } from 'lucide-react';
import { archiveAssistantDocument, listAssistantDocuments, restoreAssistantDocument, uploadAssistantDocument } from '@/api/chatbotApi.js';

const MAX_FILE_BYTES = 1024 * 1024;

export default function AssistantKnowledgeManager({ language = 'vi' }) {
    const vi = language === 'vi';
    const [documents, setDocuments] = useState([]);
    const [file, setFile] = useState(null);
    const [title, setTitle] = useState('');
    const [visibility, setVisibility] = useState('all');
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [updatingDocumentId, setUpdatingDocumentId] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const fileInputRef = useRef(null);

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

    const chooseFile = candidate => {
        setError('');
        setNotice('');
        if (!candidate) return;
        if (!/\.txt$/i.test(candidate.name) || !['text/plain', 'application/octet-stream'].includes(candidate.type || 'application/octet-stream')) {
            setFile(null);
            setError(vi ? 'Hiện tại chỉ hỗ trợ tệp văn bản .txt UTF-8.' : 'Only UTF-8 .txt text files are supported right now.');
            return;
        }
        if (candidate.size > MAX_FILE_BYTES) {
            setFile(null);
            setError(vi ? 'Tệp vượt quá giới hạn 1 MB.' : 'The file exceeds the 1 MB limit.');
            return;
        }
        setFile(candidate);
        if (!title.trim()) setTitle(candidate.name.replace(/\.txt$/i, ''));
    };

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
                ? `Đã lập chỉ mục “${result.document.title}” với ${result.document.chunkCount} đoạn nội dung.`
                : `Indexed “${result.document.title}” into ${result.document.chunkCount} content chunks.`);
            setFile(null);
            setTitle('');
            if (fileInputRef.current) fileInputRef.current.value = '';
            await load();
        } catch (err) {
            setError(err?.response?.data?.message || (vi ? 'Không thể nạp tài liệu.' : 'Document ingestion failed.'));
        } finally {
            setUploading(false);
        }
    };

    const statusLabel = status => {
        if (status === 'ready') return vi ? 'Sẵn sàng' : 'Ready';
        if (status === 'processing') return vi ? 'Đang xử lý' : 'Processing';
        if (status === 'failed') return vi ? 'Thất bại' : 'Failed';
        if (status === 'archived') return vi ? 'Đã lưu trữ' : 'Archived';
        return status || (vi ? 'Không rõ' : 'Unknown');
    };

    const changeDocumentArchiveState = async document => {
        if (updatingDocumentId) return;
        setUpdatingDocumentId(document.id);
        setError('');
        setNotice('');
        try {
            if (document.status === 'archived') {
                await restoreAssistantDocument(document.id);
                setNotice(vi ? 'Đã khôi phục tài liệu.' : 'Document restored.');
            } else {
                await archiveAssistantDocument(document.id);
                setNotice(vi ? 'Đã lưu trữ tài liệu. Nội dung và các đoạn dữ liệu vẫn được giữ lại.' : 'Document archived. Its content and chunks were retained.');
            }
            await load();
        } catch (err) {
            setError(err?.response?.data?.message || (vi ? 'Không thể cập nhật trạng thái tài liệu.' : 'Could not update document status.'));
        } finally {
            setUpdatingDocumentId(null);
        }
    };

    const visibilityLabel = value => ({
        all: vi ? 'Tất cả' : 'Everyone',
        student: vi ? 'Sinh viên' : 'Students',
        admin: vi ? 'Quản trị viên' : 'Admins'
    }[value] || value);

    return (
        <section className="space-y-4 bg-slate-50/80 p-4 dark:bg-slate-900/50 sm:p-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><BookOpen size={17} className="text-blue-600" />{vi ? 'Kho tri thức tài liệu' : 'Document knowledge base'}</div>
                    <p className="mb-0 mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{vi ? 'Quản lý nguồn tài liệu mà trợ lý được phép tra cứu khi trả lời.' : 'Manage reference documents the assistant can retrieve when answering.'}</p>
                </div>
                <button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:text-blue-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900" aria-label={vi ? 'Làm mới danh sách' : 'Refresh documents'}>
                    {loading ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                </button>
            </div>

            <form onSubmit={submit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-4">
                <div
                    onDragOver={event => { event.preventDefault(); setDragging(true); }}
                    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
                    onDrop={event => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files?.[0]); }}
                    className={`rounded-xl border border-dashed p-4 text-center transition ${dragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-slate-300 bg-slate-50/70 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900/60'}`}
                >
                    <input ref={fileInputRef} type="file" accept=".txt,text/plain" onChange={event => chooseFile(event.target.files?.[0])} className="sr-only" id="assistant-knowledge-file" />
                    <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300"><UploadCloud size={20} /></div>
                    <p className="m-0 text-xs font-semibold text-slate-800 dark:text-slate-100">{vi ? 'Kéo thả tài liệu vào đây' : 'Drag and drop a document here'}</p>
                    <p className="mb-2 mt-1 text-[11px] text-slate-400">{vi ? 'hoặc chọn tệp từ thiết bị' : 'or choose a file from your device'}</p>
                    <label htmlFor="assistant-knowledge-file" className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                        <FileUp size={14} />{vi ? 'Chọn tệp TXT' : 'Choose TXT file'}
                    </label>
                    <p className="mb-0 mt-2 text-[10px] text-slate-400">{vi ? 'UTF-8 · Tối đa 1 MB · Định dạng .txt' : 'UTF-8 · Up to 1 MB · .txt format'}</p>
                </div>

                {file && (
                    <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 dark:bg-blue-950/30">
                        <FileText size={17} className="shrink-0 text-blue-600 dark:text-blue-300" />
                        <div className="min-w-0 flex-1">
                            <p className="m-0 truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{file.name}</p>
                            <p className="m-0 text-[10px] text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                    </div>
                )}

                <label className="block space-y-1">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{vi ? 'Tên tài liệu' : 'Document title'}</span>
                    <input value={title} onChange={event => setTitle(event.target.value)} maxLength={200} placeholder={vi ? 'Ví dụ: Quy chế đào tạo 2026' : 'e.g. Academic regulations 2026'} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                </label>

                <div className="flex flex-col gap-2 sm:flex-row">
                    <label className="min-w-0 flex-1 space-y-1">
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{vi ? 'Phạm vi truy cập' : 'Access scope'}</span>
                        <select value={visibility} onChange={event => setVisibility(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                            <option value="all">{vi ? 'Tất cả người dùng' : 'All users'}</option>
                            <option value="student">{vi ? 'Chỉ sinh viên' : 'Students only'}</option>
                            <option value="admin">{vi ? 'Chỉ quản trị viên' : 'Admins only'}</option>
                        </select>
                    </label>
                    <div className="flex items-end">
                        <button type="submit" disabled={!file || uploading} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-md shadow-blue-600/15 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto">
                            {uploading ? <LoaderCircle size={15} className="animate-spin" /> : <FileUp size={15} />}
                            {uploading ? (vi ? 'Đang lập chỉ mục...' : 'Indexing...') : (vi ? 'Nạp tài liệu' : 'Index document')}
                        </button>
                    </div>
                </div>
                <p className="m-0 flex items-start gap-1.5 text-[10px] leading-4 text-slate-400"><ShieldCheck size={12} className="mt-0.5 shrink-0" />{vi ? 'Nội dung tài liệu chỉ được dùng làm dữ liệu tham khảo. Backend kiểm tra quyền truy cập trước khi truy xuất.' : 'Document content is reference data only. The backend enforces access scope during retrieval.'}</p>
            </form>

            {error && <p role="alert" className="m-0 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
            {notice && <p role="status" className="m-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{notice}</p>}

            <div className="flex items-center justify-between gap-2">
                <div>
                    <h3 className="m-0 text-xs font-bold text-slate-800 dark:text-slate-100">{vi ? 'Tài liệu đã nạp' : 'Indexed documents'}</h3>
                    <p className="mb-0 mt-0.5 text-[10px] text-slate-400">{vi ? `${documents.length} tài liệu` : `${documents.length} documents`}</p>
                </div>
                <span className="rounded-full bg-slate-200/70 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{vi ? 'Tối đa 200 mục' : 'Up to 200 items'}</span>
            </div>

            <div className="space-y-2">
                {documents.map(document => (
                    <div key={document.id} className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"><FileText size={17} /></div>
                        <div className="min-w-0 flex-1">
                            <p className="m-0 truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{document.title}</p>
                            <p className="m-0 mt-1 truncate text-[10px] text-slate-400">{document.source_name} · {visibilityLabel(document.visibility)}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${document.status === 'ready' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : document.status === 'failed' ? 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'}`}>{statusLabel(document.status)}</span>
                        {(document.status === 'ready' || document.status === 'failed' || document.status === 'archived') && (
                            <button
                                type="button"
                                onClick={() => void changeDocumentArchiveState(document)}
                                disabled={updatingDocumentId !== null}
                                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] font-semibold text-slate-600 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:text-blue-300"
                                aria-label={document.status === 'archived' ? (vi ? 'Khôi phục tài liệu' : 'Restore document') : (vi ? 'Lưu trữ tài liệu' : 'Archive document')}
                            >
                                {updatingDocumentId === document.id
                                    ? <LoaderCircle size={12} className="animate-spin" />
                                    : document.status === 'archived' ? <Undo2 size={12} /> : <Archive size={12} />}
                                {document.status === 'archived' ? (vi ? 'Khôi phục' : 'Restore') : (vi ? 'Lưu trữ' : 'Archive')}
                            </button>
                        )}
                    </div>
                ))}
                {loading && documents.length === 0 && <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-400"><LoaderCircle size={15} className="animate-spin" />{vi ? 'Đang tải tài liệu...' : 'Loading documents...'}</div>}
                {!loading && documents.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center dark:border-slate-700">
                        <BookOpen size={22} className="mx-auto mb-2 text-slate-300" />
                        <p className="m-0 text-xs font-medium text-slate-600 dark:text-slate-300">{vi ? 'Kho tri thức chưa có tài liệu' : 'Your knowledge base is empty'}</p>
                        <p className="mb-0 mt-1 text-[10px] text-slate-400">{vi ? 'Nạp tài liệu TXT đầu tiên để chatbot có nguồn tham khảo.' : 'Index your first TXT document to give the assistant reference material.'}</p>
                    </div>
                )}
            </div>
        </section>
    );
}
