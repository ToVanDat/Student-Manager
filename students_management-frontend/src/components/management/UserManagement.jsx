import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Search, ShieldCheck, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/api/client.js';
import { useLanguage } from '@/context/LanguageContext.jsx';

export default function UserManagement() {
  const { language } = useLanguage();
  const en = language === 'en';
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/users', { params: { search: search.trim() } });
      setUsers(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (err) {
      setError(err?.response?.data?.message || (en ? 'Could not load accounts.' : 'Không thể tải danh sách tài khoản.'));
    } finally {
      setLoading(false);
    }
  }, [search, en]);

  useEffect(() => { const timer = setTimeout(() => { void load(); }, 250); return () => clearTimeout(timer); }, [load]);

  const update = async (user, patch) => {
    if (savingId === user.id) return;
    setSavingId(user.id);
    try {
      const response = await apiClient.patch(`/api/users/${user.id}/access`, {
        role: patch.role ?? user.role,
        is_active: patch.is_active ?? user.is_active,
      });
      setUsers(current => current.map(item => item.id === user.id ? response.data.data : item));
      toast.success(en ? 'Account access updated.' : 'Đã cập nhật quyền tài khoản.');
    } catch (err) {
      toast.error(err?.response?.data?.message || (en ? 'Could not update account.' : 'Không thể cập nhật tài khoản.'));
      await load();
    } finally {
      setSavingId(null);
    }
  };

  const date = value => value ? new Intl.DateTimeFormat(en ? 'en-US' : 'vi-VN', { dateStyle: 'medium' }).format(new Date(value)) : '—';

  return <section className="mx-auto max-w-7xl space-y-5">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-200"><UserCog size={14}/>{en ? 'System administration' : 'Quản trị hệ thống'}</p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{en ? 'Account management' : 'Quản lý tài khoản'}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{en ? 'Review accounts and control their existing role and active status.' : 'Xem tài khoản và quản lý vai trò, trạng thái hoạt động hiện có.'}</p></div>
      <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><RefreshCw size={15}/>{en ? 'Refresh' : 'Làm mới'}</button>
    </header>
    <div className="app-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-sm font-semibold text-slate-900 dark:text-white">{en ? 'Accounts' : 'Danh sách tài khoản'}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{en ? 'Up to 200 matching accounts' : 'Tối đa 200 tài khoản phù hợp'}</p></div>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 dark:border-slate-700 sm:w-80"><Search size={16} className="text-slate-400"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder={en ? 'Search username or email' : 'Tìm tên tài khoản hoặc email'} className="min-w-0 flex-1 border-0 bg-transparent py-2.5 text-sm outline-none focus:ring-0 dark:text-white" /></label>
      </div>
      {loading ? <div role="status" className="p-8 text-sm text-slate-500">{en ? 'Loading accounts…' : 'Đang tải tài khoản…'}</div>
       : error ? <div role="alert" className="p-8 text-center"><p className="text-sm text-rose-700 dark:text-rose-300">{error}</p><button onClick={() => void load()} className="mt-3 rounded-lg border px-3 py-2 text-sm dark:border-slate-700">{en ? 'Retry' : 'Thử lại'}</button></div>
       : users.length === 0 ? <div className="p-12 text-center text-sm text-slate-500">{en ? 'No matching accounts.' : 'Không tìm thấy tài khoản phù hợp.'}</div>
       : <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-300"><tr><th className="px-5 py-3">{en ? 'Account' : 'Tài khoản'}</th><th className="px-5 py-3">{en ? 'Role' : 'Vai trò'}</th><th className="px-5 py-3">{en ? 'Status' : 'Trạng thái'}</th><th className="px-5 py-3">{en ? 'Created' : 'Ngày tạo'}</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{users.map(user => <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40"><td className="px-5 py-4"><p className="font-semibold text-slate-900 dark:text-white">{user.username}</p><p className="mt-1 text-xs text-slate-500">{user.email}</p><p className="mt-1 text-[11px] text-slate-400">ID: {user.id}</p></td><td className="px-5 py-4"><select aria-label={en ? `Role for ${user.username}` : `Vai trò của ${user.username}`} value={user.role} disabled={savingId === user.id} onChange={e => void update(user, { role: e.target.value })} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="user">{en ? 'User' : 'Người dùng'}</option><option value="admin">Admin</option></select></td><td className="px-5 py-4"><label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(user.is_active)} disabled={savingId === user.id} onChange={e => void update(user, { is_active: e.target.checked })} className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"/><span className={user.is_active ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500'}>{user.is_active ? (en ? 'Active' : 'Hoạt động') : (en ? 'Disabled' : 'Đã vô hiệu hóa')}</span></label></td><td className="px-5 py-4 text-slate-500 dark:text-slate-400">{date(user.created_at)}</td></tr>)}</tbody></table></div>}
    </div>
    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{en ? 'For safety, you cannot change your own role/status or disable/demote the last active administrator. The API enforces these rules, not only this screen.' : 'Để an toàn, bạn không thể tự đổi vai trò/trạng thái của mình hoặc vô hiệu hóa/hạ quyền quản trị viên đang hoạt động cuối cùng. Các quy tắc này được kiểm tra ở API, không chỉ ở giao diện.'}</p>
  </section>;
}
