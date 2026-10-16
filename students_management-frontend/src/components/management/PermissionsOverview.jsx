import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, LoaderCircle, RefreshCw, Save, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/api/client.js';
import { useLanguage } from '@/context/LanguageContext.jsx';

const MODULE_ORDER = ['students', 'classes', 'departments', 'subjects', 'semesters', 'enrollments', 'accounts', 'permissions'];

export default function PermissionsOverview() {
  const { language } = useLanguage();
  const en = language === 'en';
  const [permissions, setPermissions] = useState([]);
  const [drafts, setDrafts] = useState({ admin: {}, user: {} });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [savingRole, setSavingRole] = useState('');
  const [activeRole, setActiveRole] = useState('user');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await apiClient.get('/api/permissions');
      const rows = Array.isArray(response.data?.data) ? response.data.data : [];
      setPermissions(rows);
      setDrafts({
        admin: Object.fromEntries(rows.map(item => [item.permission_key, Boolean(item.admin_allowed)])),
        user: Object.fromEntries(rows.map(item => [item.permission_key, Boolean(item.user_allowed)])),
      });
    } catch (error) {
      setLoadError(error?.response?.data?.message || (en ? 'Could not load permissions. Apply the database migration and try again.' : 'Không thể tải quyền. Hãy áp dụng migration cơ sở dữ liệu rồi thử lại.'));
    } finally {
      setLoading(false);
    }
  }, [en]);

  useEffect(() => { void load(); }, [load]);

  const grouped = useMemo(() => MODULE_ORDER.map(moduleKey => ({
    moduleKey,
    items: permissions.filter(item => item.module_key === moduleKey),
  })).filter(group => group.items.length), [permissions]);

  const dirty = useMemo(() => ({
    admin: permissions.some(item => Boolean(drafts.admin[item.permission_key]) !== Boolean(item.admin_allowed)),
    user: permissions.some(item => Boolean(drafts.user[item.permission_key]) !== Boolean(item.user_allowed)),
  }), [permissions, drafts]);

  const moduleName = key => ({
    students: en ? 'Student records' : 'Hồ sơ sinh viên',
    classes: en ? 'Classes' : 'Lớp học',
    departments: en ? 'Departments' : 'Khoa',
    subjects: en ? 'Subjects' : 'Môn học',
    semesters: en ? 'Semesters' : 'Học kỳ',
    enrollments: en ? 'Enrollments and grades' : 'Đăng ký học và điểm',
    accounts: en ? 'Account administration' : 'Quản trị tài khoản',
    permissions: en ? 'Permission administration' : 'Quản trị phân quyền',
  })[key] || key;

  const save = async role => {
    if (savingRole) return;
    setSavingRole(role);
    try {
      const response = await apiClient.put(`/api/permissions/roles/${role}`, {
        permissions: permissions.map(item => ({
          permission_key: item.permission_key,
          allowed: Boolean(drafts[role][item.permission_key]),
        })),
      });
      const updated = response.data?.data?.permissions;
      if (!Array.isArray(updated)) throw new Error('Invalid permission response');
      setPermissions(current => current.map(item => {
        const grant = updated.find(value => value.permission_key === item.permission_key);
        return grant ? { ...item, [role === 'admin' ? 'admin_allowed' : 'user_allowed']: Boolean(grant.allowed) } : item;
      }));
      toast.success(en ? 'Role permissions saved.' : 'Đã lưu quyền cho vai trò.');
    } catch (error) {
      toast.error(error?.response?.data?.message || (en ? 'Could not save permissions.' : 'Không thể lưu phân quyền.'));
      await load();
    } finally {
      setSavingRole('');
    }
  };

  return <section className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"><ShieldCheck size={14}/>{en ? 'ACCESS CONTROL' : 'KIỂM SOÁT TRUY CẬP'}</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">{en ? 'Role permissions' : 'Phân quyền theo vai trò'}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">{en ? 'Configure feature-level access for Admin and User. Sensitive records and administrative actions still require the Admin role in the backend.' : 'Cấu hình quyền theo từng chức năng cho Admin và Người dùng. Dữ liệu nhạy cảm và thao tác quản trị vẫn bắt buộc vai trò Admin ở backend.'}</p>
      </div>
      <button type="button" onClick={() => void load()} disabled={loading || Boolean(savingRole)} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/>{en ? 'Refresh' : 'Làm mới'}</button>
    </header>

    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900" role="tablist" aria-label={en ? 'Select role' : 'Chọn vai trò'}>
      {['user', 'admin'].map(role => <button key={role} type="button" role="tab" aria-selected={activeRole === role} onClick={() => setActiveRole(role)} className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${activeRole === role ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>{role === 'admin' ? <ShieldCheck size={16}/> : <Users size={16}/>} {role === 'admin' ? 'Admin' : (en ? 'User' : 'Người dùng')}</button>)}
      <span className="ml-auto px-2 text-xs text-slate-500 dark:text-slate-400">{permissions.length} {en ? 'permissions' : 'quyền'}</span>
    </div>

    {loading ? <div className="app-card flex items-center justify-center gap-3 p-12 text-sm text-slate-500" role="status"><LoaderCircle size={18} className="animate-spin"/>{en ? 'Loading permissions…' : 'Đang tải danh sách quyền…'}</div>
    : loadError ? <div className="app-card flex flex-col items-center p-8 text-center" role="alert"><ShieldAlert size={24} className="text-rose-500"/><p className="mt-3 max-w-xl text-sm text-slate-600 dark:text-slate-300">{loadError}</p><button type="button" onClick={() => void load()} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">{en ? 'Try again' : 'Thử lại'}</button></div>
    : <div className="space-y-4">
      {grouped.map(group => <section key={group.moduleKey} className="app-card overflow-hidden">
        <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800"><h2 className="font-semibold text-slate-900 dark:text-white">{moduleName(group.moduleKey)}</h2></header>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {group.items.map(item => <label key={item.permission_key} className="flex cursor-pointer items-start gap-4 px-5 py-4 transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
            <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{en ? item.label_en : item.label_vi}{item.is_sensitive && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">{en ? 'Sensitive' : 'Nhạy cảm'}</span>}</span><span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{en ? item.description_en : item.description_vi}</span><span className="mt-1 block font-mono text-[10px] text-slate-400">{item.permission_key}</span></span>
            <span className="relative mt-1 inline-flex shrink-0 items-center">
              <input type="checkbox" checked={Boolean(drafts[activeRole][item.permission_key])} disabled={Boolean(savingRole)} onChange={event => setDrafts(current => ({ ...current, [activeRole]: { ...current[activeRole], [item.permission_key]: event.target.checked } }))} aria-label={`${activeRole}: ${item.permission_key}`} className="peer sr-only"/>
              <span className="h-6 w-11 rounded-full bg-slate-200 transition peer-checked:bg-blue-600 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2 peer-disabled:opacity-50 dark:bg-slate-700"/>
              <span className="pointer-events-none absolute left-1 grid size-4 place-items-center rounded-full bg-white shadow transition peer-checked:translate-x-5">{drafts[activeRole][item.permission_key] && <Check size={10} className="text-blue-600"/>}</span>
            </span>
          </label>)}
        </div>
      </section>)}
      <div className="sticky bottom-3 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between dark:border-slate-700 dark:bg-slate-900/95">
        <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{dirty[activeRole] ? (en ? 'You have unsaved changes.' : 'Bạn có thay đổi chưa lưu.') : (en ? 'All changes are saved.' : 'Mọi thay đổi đã được lưu.')}</p>
        <button type="button" onClick={() => void save(activeRole)} disabled={!dirty[activeRole] || Boolean(savingRole)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{savingRole === activeRole ? <LoaderCircle size={16} className="animate-spin"/> : <Save size={16}/>} {savingRole === activeRole ? (en ? 'Saving…' : 'Đang lưu…') : (en ? 'Save permissions' : 'Lưu phân quyền')}</button>
      </div>
    </div>}

    <div className="flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/20"><ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300"/><div><p className="text-sm font-semibold text-amber-950 dark:text-amber-100">{en ? 'Security safeguards' : 'Nguyên tắc an toàn'}</p><p className="mt-1 text-xs leading-5 text-amber-900/80 dark:text-amber-100/80">{en ? 'Feature grants do not elevate a User to Admin. Sensitive student records, grades, account management and permission management retain server-side role checks. The Admin role's permission-management grant is reserved to prevent locking administrators out.' : 'Quyền chức năng không nâng Người dùng thành Admin. Hồ sơ sinh viên, điểm, quản trị tài khoản và phân quyền vẫn được kiểm tra vai trò ở máy chủ. Quyền quản lý phân quyền của vai trò Admin luôn được giữ bật để tránh khóa toàn bộ quản trị viên.'}</p></div></div>
  </section>;
}
