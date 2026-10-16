import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleUserRound, LoaderCircle, RefreshCw, Search, ShieldAlert, ShieldCheck, UserCog, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/api/client.js';
import { useLanguage } from '@/context/LanguageContext.jsx';

const initialsFor = (value = '') => value.trim().split(/[\s._-]+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || '?';

export default function UserManagement() {
  const { language } = useLanguage();
  const en = language === 'en';
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [pendingDisable, setPendingDisable] = useState(null);
  const requestId = useRef(0);
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(null);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/users', { params: { search: search.trim() } });
      if (id !== requestId.current) return;
      setUsers(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err?.response?.data?.message || (en ? 'Could not load accounts. Check your connection and try again.' : 'Không thể tải tài khoản. Hãy kiểm tra kết nối và thử lại.'));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [search, en]);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!pendingDisable) {
      returnFocusRef.current?.focus?.();
      return undefined;
    }

    const dialog = dialogRef.current;
    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const getFocusable = () => [...(dialog?.querySelectorAll(focusableSelector) || [])]
      .filter(element => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true');

    getFocusable()[0]?.focus();

    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setPendingDisable(null);
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = getFocusable();
      if (!focusable.length) {
        event.preventDefault();
        dialog?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingDisable]);

  const update = async (user, patch) => {
    if (savingId === user.id) return;
    setSavingId(user.id);
    try {
      const response = await apiClient.patch(`/api/users/${user.id}/access`, {
        role: patch.role ?? user.role,
        is_active: patch.is_active ?? user.is_active,
      });
      if (!response.data?.data) throw new Error('Missing updated account');
      setUsers(current => current.map(item => item.id === user.id ? response.data.data : item));
      toast.success(en ? 'Account access updated.' : 'Đã cập nhật quyền tài khoản.');
    } catch (err) {
      toast.error(err?.response?.data?.message || (en ? 'Could not update account. Please try again.' : 'Không thể cập nhật tài khoản. Vui lòng thử lại.'));
      await load();
    } finally {
      setSavingId(null);
      setPendingDisable(null);
    }
  };

  const formatDate = value => {
    if (!value || Number.isNaN(new Date(value).getTime())) return '—';
    return new Intl.DateTimeFormat(en ? 'en-US' : 'vi-VN', { dateStyle: 'medium' }).format(new Date(value));
  };
  const activeCount = users.filter(user => Boolean(user.is_active)).length;
  const adminCount = users.filter(user => user.role === 'admin').length;

  return <section className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"><UserCog size={14}/>{en ? 'SYSTEM ADMINISTRATION' : 'QUẢN TRỊ HỆ THỐNG'}</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">{en ? 'Account management' : 'Quản lý tài khoản'}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">{en ? 'Manage existing roles and account access. Changes are checked by the server before being applied.' : 'Quản lý vai trò và trạng thái truy cập. Máy chủ kiểm tra trước khi áp dụng thay đổi.'}</p>
      </div>
      <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:self-auto"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/>{en ? 'Refresh list' : 'Làm mới danh sách'}</button>
    </header>

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <article className="app-card flex items-center gap-4 p-4 sm:p-5"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"><Users size={21}/></span><div><p className="text-xs font-medium text-slate-500 dark:text-slate-400">{en ? 'Accounts in results' : 'Tài khoản trong kết quả'}</p><p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{loading ? '—' : users.length}</p></div></article>
      <article className="app-card flex items-center gap-4 p-4 sm:p-5"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"><CheckCircle2 size={21}/></span><div><p className="text-xs font-medium text-slate-500 dark:text-slate-400">{en ? 'Active accounts' : 'Tài khoản hoạt động'}</p><p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{loading ? '—' : activeCount}</p></div></article>
      <article className="app-card flex items-center gap-4 p-4 sm:p-5"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300"><ShieldCheck size={21}/></span><div><p className="text-xs font-medium text-slate-500 dark:text-slate-400">{en ? 'Administrators' : 'Quản trị viên'}</p><p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{loading ? '—' : adminCount}</p></div></article>
    </div>

    <div className="app-card overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-4 dark:border-slate-800 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div><h2 className="text-base font-semibold text-slate-900 dark:text-white">{en ? 'Accounts' : 'Danh sách tài khoản'}</h2><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{en ? 'Search by username or email · Up to 200 results' : 'Tìm theo tên tài khoản hoặc email · Tối đa 200 kết quả'}</p></div>
        <label className="flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 transition focus-within:border-blue-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-950 dark:focus-within:bg-slate-900 lg:max-w-md">
          <Search size={17} className="shrink-0 text-slate-400"/><input value={search} onChange={e => setSearch(e.target.value)} aria-label={en ? 'Search accounts' : 'Tìm kiếm tài khoản'} placeholder={en ? 'Username or email…' : 'Tên tài khoản hoặc email…'} className="min-w-0 flex-1 border-0 bg-transparent py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0 dark:text-white"/>
          {search && <button type="button" onClick={() => setSearch('')} aria-label={en ? 'Clear search' : 'Xóa tìm kiếm'} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"><X size={15}/></button>}
        </label>
      </div>
      {loading ? <div role="status" aria-live="polite" className="space-y-3 p-5"><div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300"><LoaderCircle size={17} className="animate-spin"/>{en ? 'Loading accounts…' : 'Đang tải tài khoản…'}</div>{[0,1,2].map(i => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"/>)}</div>
      : error ? <div role="alert" className="flex flex-col items-center px-5 py-12 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300"><ShieldAlert size={22}/></span><h3 className="mt-4 font-semibold text-slate-900 dark:text-white">{en ? 'Could not load accounts' : 'Không tải được danh sách'}</h3><p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">{error}</p><button type="button" onClick={() => void load()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><RefreshCw size={15}/>{en ? 'Try again' : 'Thử lại'}</button></div>
      : users.length === 0 ? <div className="flex flex-col items-center px-5 py-14 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800"><Search size={22}/></span><h3 className="mt-4 font-semibold text-slate-900 dark:text-white">{search.trim() ? (en ? 'No matching accounts' : 'Không tìm thấy tài khoản') : (en ? 'No accounts to display' : 'Chưa có tài khoản để hiển thị')}</h3><p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">{search.trim() ? (en ? 'Try another username or email, or clear your search.' : 'Thử tên tài khoản/email khác hoặc xóa tìm kiếm.') : (en ? 'Accounts will appear here when available.' : 'Danh sách tài khoản sẽ hiển thị tại đây khi có dữ liệu.')}</p>{search.trim() && <button type="button" onClick={() => setSearch('')} className="mt-4 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">{en ? 'Clear search' : 'Xóa tìm kiếm'}</button>}</div>
      : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-800/70 dark:text-slate-400"><tr><th scope="col" className="px-5 py-3.5">{en ? 'Account' : 'Tài khoản'}</th><th scope="col" className="px-5 py-3.5">{en ? 'Role' : 'Vai trò'}</th><th scope="col" className="px-5 py-3.5">{en ? 'Account status' : 'Trạng thái'}</th><th scope="col" className="px-5 py-3.5">{en ? 'Created' : 'Ngày tạo'}</th></tr></thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{users.map(user => <tr key={user.id} className="transition-colors hover:bg-blue-50/30 dark:hover:bg-slate-800/40">
        <td className="px-5 py-4"><div className="flex min-w-0 items-center gap-3"><span className={`grid size-10 shrink-0 place-items-center rounded-full text-xs font-bold ring-1 ring-inset ${user.is_active ? 'bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-blue-200 dark:from-blue-950 dark:to-indigo-950 dark:text-blue-200 dark:ring-blue-900' : 'bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700'}`}>{initialsFor(user.username)}</span><div className="min-w-0"><p className="max-w-[260px] truncate font-semibold text-slate-900 dark:text-white">{user.username || (en ? 'Unnamed account' : 'Tài khoản chưa có tên')}</p><p className="mt-1 max-w-[280px] truncate text-xs text-slate-500 dark:text-slate-400">{user.email || '—'}</p><p className="mt-1 text-[11px] text-slate-400">ID: {user.id}</p></div></div></td>
        <td className="px-5 py-4"><div className="flex flex-col items-start gap-2"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${user.role === 'admin' ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>{user.role === 'admin' ? <ShieldCheck size={13}/> : <CircleUserRound size={13}/>} {user.role === 'admin' ? 'Admin' : (en ? 'User' : 'Người dùng')}</span><select aria-label={en ? `Change role for ${user.username}` : `Đổi vai trò của ${user.username}`} value={user.role} disabled={savingId === user.id} onChange={e => void update(user, { role: e.target.value })} className="max-w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/15 disabled:cursor-wait disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><option value="user">{en ? 'Set as User' : 'Đặt làm Người dùng'}</option><option value="admin">{en ? 'Set as Admin' : 'Đặt làm Admin'}</option></select></div></td>
        <td className="px-5 py-4"><div className="flex flex-col items-start gap-2"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${user.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'}`}><span className={`size-1.5 rounded-full ${user.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`}/>{user.is_active ? (en ? 'Active' : 'Hoạt động') : (en ? 'Disabled' : 'Đã vô hiệu hóa')}</span><button type="button" disabled={savingId === user.id} onClick={event => {
          if (user.is_active) {
            returnFocusRef.current = event.currentTarget;
            setPendingDisable(user);
          } else {
            void update(user, { is_active: true });
          }
        }} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait disabled:opacity-50 ${user.is_active ? 'border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950/40'}`}>{savingId === user.id ? <LoaderCircle size={13} className="animate-spin"/> : user.is_active ? <ShieldAlert size={13}/> : <CheckCircle2 size={13}/>}{user.is_active ? (en ? 'Disable account' : 'Vô hiệu hóa') : (en ? 'Activate account' : 'Kích hoạt')}</button></div></td>
        <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500 dark:text-slate-400">{formatDate(user.created_at)}</td>
      </tr>)}</tbody></table></div>}
      {!loading && !error && users.length > 0 && <div className="flex flex-col gap-1 border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between"><span>{en ? `Showing ${users.length} account(s)` : `Đang hiển thị ${users.length} tài khoản`}</span><span>{en ? 'Changes are saved through the server.' : 'Thay đổi được lưu qua máy chủ.'}</span></div>}
    </div>
    <div className="flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/20"><span className="mt-0.5 text-amber-700 dark:text-amber-300"><ShieldCheck size={18}/></span><div><p className="text-sm font-semibold text-amber-950 dark:text-amber-100">{en ? 'Administrator safety' : 'Bảo vệ quyền quản trị'}</p><p className="mt-1 text-xs leading-5 text-amber-900/80 dark:text-amber-100/80">{en ? 'You cannot change your own role/status or disable/demote the last active administrator. The API enforces these rules independently of the UI.' : 'Bạn không thể tự đổi vai trò/trạng thái của mình hoặc vô hiệu hóa/hạ quyền quản trị viên đang hoạt động cuối cùng. API kiểm tra các quy tắc này độc lập với giao diện.'}</p></div></div>

    {pendingDisable && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPendingDisable(null); }}><section ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="disable-account-title" aria-describedby="disable-account-description" tabIndex={-1} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:p-6"><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300"><AlertTriangle size={22}/></span><div className="min-w-0 flex-1"><h2 id="disable-account-title" className="text-lg font-bold text-slate-900 dark:text-white">{en ? 'Disable this account?' : 'Vô hiệu hóa tài khoản này?'}</h2><p id="disable-account-description" className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{en ? 'The account may lose access to protected features. Existing data will not be deleted.' : 'Tài khoản có thể mất quyền truy cập các chức năng được bảo vệ. Dữ liệu hiện có sẽ không bị xóa.'}</p><div className="mt-4 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/80"><p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{pendingDisable.username}</p><p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{pendingDisable.email}</p></div></div><button type="button" onClick={() => setPendingDisable(null)} aria-label={en ? 'Close confirmation' : 'Đóng xác nhận'} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18}/></button></div><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setPendingDisable(null)} className="min-h-10 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">{en ? 'Cancel' : 'Hủy'}</button><button type="button" disabled={savingId === pendingDisable.id} onClick={() => void update(pendingDisable, { is_active: false })} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">{savingId === pendingDisable.id && <LoaderCircle size={15} className="animate-spin"/>}{en ? 'Disable account' : 'Vô hiệu hóa tài khoản'}</button></div></section></div>}
  </section>;
}
