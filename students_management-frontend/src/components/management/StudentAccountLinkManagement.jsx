import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Link2, LoaderCircle, RefreshCw, Search, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext.jsx';
import { createStudentAccountLink, deleteStudentAccountLink, getStudentAccountLinks } from '@/api/studentApi.js';

export default function StudentAccountLinkManagement() {
    const { language } = useLanguage();
    const en = language === 'en';
    const [search, setSearch] = useState('');
    const [data, setData] = useState({ linked: [], availableUsers: [], availableStudents: [], audit: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [userId, setUserId] = useState('');
    const [studentId, setStudentId] = useState('');
    const [confirmed, setConfirmed] = useState(false);
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [unlinkTarget, setUnlinkTarget] = useState(null);
    const [unlinkReason, setUnlinkReason] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const result = await getStudentAccountLinks(search.trim());
            setData({
                linked: Array.isArray(result?.linked) ? result.linked : [],
                availableUsers: Array.isArray(result?.availableUsers) ? result.availableUsers : [],
                availableStudents: Array.isArray(result?.availableStudents) ? result.availableStudents : [],
                audit: Array.isArray(result?.audit) ? result.audit : [],
            });
        } catch (err) {
            setError(err?.response?.data?.message || (en ? 'Could not load account-linking data.' : 'Không thể tải dữ liệu liên kết tài khoản.'));
        } finally {
            setLoading(false);
        }
    }, [search, en]);

    useEffect(() => {
        const timer = setTimeout(() => { void load(); }, 250);
        return () => clearTimeout(timer);
    }, [load]);

    const link = async event => {
        event.preventDefault();
        if (!userId || !studentId || !confirmed || saving) return;
        setSaving(true);
        try {
            await createStudentAccountLink({
                userId: Number(userId),
                studentId: Number(studentId),
                confirmIdentity: true,
                verificationNote: note.trim(),
            });
            toast.success(en ? 'Student account linked after manual verification.' : 'Đã liên kết tài khoản sau khi admin xác minh.');
            setUserId('');
            setStudentId('');
            setConfirmed(false);
            setNote('');
            await load();
        } catch (err) {
            toast.error(err?.response?.data?.message || (en ? 'Could not link this account.' : 'Không thể liên kết tài khoản này.'));
            await load();
        } finally {
            setSaving(false);
        }
    };

    const unlink = async () => {
        if (!unlinkTarget || unlinkReason.trim().length < 10 || saving) return;
        setSaving(true);
        try {
            await deleteStudentAccountLink(unlinkTarget.user_id, unlinkReason.trim());
            toast.success(en ? 'Account link removed; audit history retained.' : 'Đã hủy liên kết; lịch sử thao tác vẫn được lưu.');
            setUnlinkTarget(null);
            setUnlinkReason('');
            await load();
        } catch (err) {
            toast.error(err?.response?.data?.message || (en ? 'Could not remove the link.' : 'Không thể hủy liên kết.'));
        } finally {
            setSaving(false);
        }
    };

    const inputClass = 'mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/15 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';
    const userLabel = user => [user.username, user.email].filter(Boolean).join(' · ');
    const studentLabel = student => [student.student_code, student.name, student.class_code].filter(Boolean).join(' · ');

    return <section className="app-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div><p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300"><Link2 size={14}/>{en ? 'Identity verification' : 'Xác minh và liên kết hồ sơ'}</p><h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{en ? 'User ↔ student record' : 'Tài khoản ↔ hồ sơ sinh viên'}</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 dark:text-slate-400">{en ? 'Manually verify identity against official records before linking. Email similarity is never proof of identity.' : 'Admin phải đối chiếu danh tính với hồ sơ chính thức trước khi liên kết. Email trùng khớp không phải bằng chứng xác minh.'}</p></div>
            <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/>{en ? 'Refresh' : 'Làm mới'}</button>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
            <form onSubmit={link} className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><CheckCircle2 size={17} className="text-blue-600 dark:text-blue-300"/>{en ? 'Create verified link' : 'Tạo liên kết đã xác minh'}</div>
                <div className="grid gap-3 lg:grid-cols-2">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{en ? 'Active user account' : 'Tài khoản user đang hoạt động'}
                        <select required value={userId} onChange={e => setUserId(e.target.value)} className={inputClass}><option value="">{en ? 'Select an account…' : 'Chọn tài khoản…'}</option>{data.availableUsers.map(user => <option key={user.id} value={user.id}>{userLabel(user)}</option>)}</select>
                    </label>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{en ? 'Unlinked student record' : 'Hồ sơ sinh viên chưa liên kết'}
                        <select required value={studentId} onChange={e => setStudentId(e.target.value)} className={inputClass}><option value="">{en ? 'Select a student…' : 'Chọn hồ sơ sinh viên…'}</option>{data.availableStudents.map(student => <option key={student.id} value={student.id}>{studentLabel(student)}</option>)}</select>
                    </label>
                </div>
                <label className="mt-3 block text-xs font-semibold text-slate-600 dark:text-slate-300">{en ? 'Internal verification note (do not enter ID numbers or sensitive documents)' : 'Ghi chú xác minh nội bộ (không nhập số giấy tờ hoặc dữ liệu nhạy cảm)'}
                    <input maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder={en ? 'e.g. Checked against registrar records' : 'Ví dụ: Đã đối chiếu với hồ sơ Phòng đào tạo'} className={inputClass}/>
                </label>
                <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-slate-700 dark:text-slate-200"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5 size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"/><span>{en ? 'I have verified this person using the institution’s official identity/academic records and confirm that this account belongs to the selected student.' : 'Tôi đã xác minh người này bằng hồ sơ định danh/học vụ chính thức của nhà trường và xác nhận tài khoản được chọn thuộc về sinh viên đã chọn.'}</span></label>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">{en ? 'One account ↔ one student. The server enforces uniqueness and records the administrator.' : 'Một tài khoản ↔ một sinh viên. Máy chủ tự kiểm tra tính duy nhất và lưu người thực hiện.'}</p><button type="submit" disabled={!userId || !studentId || !confirmed || saving || loading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? <LoaderCircle size={15} className="animate-spin"/> : <Link2 size={15} />}{en ? 'Verify and link' : 'Xác minh và liên kết'}</button></div>
            </form>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-sm font-bold text-slate-900 dark:text-white">{en ? 'Current verified links' : 'Các liên kết đã xác minh'}</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{en ? 'Removing a link revokes portal access but does not delete either record.' : 'Hủy liên kết sẽ thu hồi quyền xem portal nhưng không xóa tài khoản hay hồ sơ sinh viên.'}</p></div><label className="flex min-h-10 w-full items-center gap-2 rounded-xl border border-slate-200 px-3 sm:max-w-xs dark:border-slate-700"><Search size={15} className="text-slate-400"/><input value={search} onChange={e => setSearch(e.target.value)} maxLength={100} placeholder={en ? 'Search account or student…' : 'Tìm tài khoản hoặc sinh viên…'} className="min-w-0 flex-1 bg-transparent text-sm outline-none dark:text-white"/></label></div>

            {error ? <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-200"><AlertTriangle size={17} className="mt-0.5 shrink-0"/><span>{error}</span></div>
            : loading ? <div role="status" className="flex items-center gap-2 py-6 text-sm text-slate-500"><LoaderCircle size={17} className="animate-spin"/>{en ? 'Loading links…' : 'Đang tải liên kết…'}</div>
            : data.linked.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">{en ? 'No verified links match this search.' : 'Không có liên kết đã xác minh phù hợp.'}</div>
            : <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300"><tr><th className="px-4 py-3">{en ? 'User account' : 'Tài khoản'}</th><th className="px-4 py-3">{en ? 'Student record' : 'Hồ sơ sinh viên'}</th><th className="px-4 py-3">{en ? 'Verified by' : 'Người xác minh'}</th><th className="px-4 py-3">{en ? 'Verified at' : 'Thời điểm'}</th><th className="px-4 py-3">{en ? 'Action' : 'Thao tác'}</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{data.linked.map(item => <tr key={item.user_id}><td className="px-4 py-3"><p className="font-semibold text-slate-800 dark:text-slate-100">{item.username}</p><p className="text-xs text-slate-500">{item.email}</p></td><td className="px-4 py-3"><p className="font-semibold text-slate-800 dark:text-slate-100">{item.student_code} · {item.student_name}</p><p className="text-xs text-slate-500">{[item.class_code, item.class_name].filter(Boolean).join(' · ')}</p></td><td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{item.verified_by_username || '—'}</td><td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{item.verified_at ? new Intl.DateTimeFormat(en ? 'en-US' : 'vi-VN', { dateStyle: 'medium' }).format(new Date(item.verified_at)) : '—'}</td><td className="px-4 py-3"><button type="button" onClick={() => { setUnlinkTarget(item); setUnlinkReason(''); }} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-200 px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"><Unlink size={13}/>{en ? 'Unlink' : 'Hủy liên kết'}</button></td></tr>)}</tbody></table></div>}
            <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
                <div className="mb-3"><h3 className="text-sm font-bold text-slate-900 dark:text-white">{en ? 'Recent verification activity' : 'Lịch sử xác minh gần đây'}</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{en ? 'Audit history is retained when a link is removed.' : 'Lịch sử vẫn được giữ lại kể cả khi hủy liên kết.'}</p></div>
                {data.audit.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-xs text-slate-500 dark:border-slate-700">{en ? 'No audit activity yet.' : 'Chưa có hoạt động xác minh.'}</p> : <ul className="divide-y divide-slate-100 dark:divide-slate-800">{data.audit.slice(0, 10).map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><div className="min-w-0"><p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{item.action === 'linked' ? (en ? 'Linked' : 'Đã liên kết') : (en ? 'Unlinked' : 'Đã hủy liên kết')} · {item.username || item.user_id} ↔ {item.student_code || item.student_id}{item.student_name ? ` · ${item.student_name}` : ''}</p><p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{en ? 'By' : 'Người thực hiện'}: {item.actor_username || item.actor_user_id}{item.note ? ` · ${item.note}` : ''}</p></div><time className="shrink-0 text-[11px] text-slate-400">{item.occurred_at ? new Intl.DateTimeFormat(en ? 'en-US' : 'vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.occurred_at)) : '—'}</time></li>)}</ul>}
            </div>
        </div>

        {unlinkTarget && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setUnlinkTarget(null); }}><section role="alertdialog" aria-modal="true" aria-labelledby="unlink-title" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300"><Unlink size={19}/></span><div><h3 id="unlink-title" className="font-bold text-slate-900 dark:text-white">{en ? 'Remove this account link?' : 'Hủy liên kết tài khoản này?'}</h3><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{itemLabel(unlinkTarget, en)}</p></div></div><label className="mt-4 block text-xs font-semibold text-slate-600 dark:text-slate-300">{en ? 'Reason (10–500 characters)' : 'Lý do (10–500 ký tự)'}<textarea value={unlinkReason} onChange={e => setUnlinkReason(e.target.value)} maxLength={500} rows={3} className={inputClass}/></label><div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={saving} onClick={() => setUnlinkTarget(null)} className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold dark:border-slate-700 dark:text-slate-200">{en ? 'Cancel' : 'Đóng'}</button><button type="button" disabled={saving || unlinkReason.trim().length < 10} onClick={() => void unlink()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{saving && <LoaderCircle size={15} className="animate-spin"/>}{en ? 'Confirm unlink' : 'Xác nhận hủy'}</button></div></section></div>}
    </section>;
}

function itemLabel(item, en) {
    return en ? `${item.username} ↔ ${item.student_code} (${item.student_name})` : `${item.username} ↔ ${item.student_code} (${item.student_name})`;
}
