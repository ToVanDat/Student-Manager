import { GraduationCap, MessageSquare, Settings2, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext.jsx';

export default function PermissionsOverview() {
  const { language } = useLanguage();
  const en = language === 'en';
  const modules = [
    { icon: GraduationCap, title: en ? 'Academic records' : 'Dữ liệu học vụ', admin: en ? 'Manage records using available admin screens.' : 'Quản lý dữ liệu qua các màn hình quản trị hiện có.', user: en ? 'Access depends on the API and student-facing screens.' : 'Quyền truy cập phụ thuộc API và màn hình dành cho người dùng.' },
    { icon: Users, title: en ? 'Account access' : 'Tài khoản', admin: en ? 'Manage account role and active status.' : 'Quản lý vai trò và trạng thái tài khoản.', user: en ? 'Cannot access account administration.' : 'Không được truy cập khu vực quản trị tài khoản.' },
    { icon: MessageSquare, title: en ? 'Chat and calls' : 'Chat và cuộc gọi', admin: en ? 'Use available chat features subject to membership rules.' : 'Sử dụng tính năng chat theo quy tắc thành viên hiện có.', user: en ? 'Use available chat features subject to membership rules.' : 'Sử dụng tính năng chat theo quy tắc thành viên hiện có.' },
    { icon: Settings2, title: en ? 'Personal settings' : 'Cài đặt cá nhân', admin: en ? 'Manage personal settings for own account.' : 'Quản lý cài đặt cá nhân của chính mình.', user: en ? 'Manage personal settings for own account.' : 'Quản lý cài đặt cá nhân của chính mình.' },
  ];
  return <section className="mx-auto max-w-6xl space-y-6">
    <header>
      <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"><ShieldCheck size={14}/>{en ? 'SECURITY OVERVIEW' : 'TỔNG QUAN BẢO MẬT'}</p>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">{en ? 'Roles and access' : 'Vai trò và quyền truy cập'}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">{en ? 'A readable overview of the two roles currently supported by the application. This is a reference screen, not a configurable permission editor.' : 'Tổng quan dễ theo dõi về hai vai trò ứng dụng hiện hỗ trợ. Đây là trang tham khảo, chưa phải công cụ chỉnh sửa quyền tùy biến.'}</p>
    </header>

    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <article className="app-card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-100 p-5 dark:border-slate-800"><span className="grid size-11 place-items-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300"><ShieldCheck size={21}/></span><div><h2 className="font-semibold text-slate-900 dark:text-white">Admin</h2><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{en ? 'Administrative role' : 'Vai trò quản trị'}</p></div><span className="ml-auto rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">{en ? 'Admin' : 'Quản trị'}</span></div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">{modules.map(({ icon: Icon, title, admin }) => <div key={title} className="flex items-start gap-3 px-5 py-4"><span className="mt-0.5 text-slate-400"><Icon size={17}/></span><div><p className="text-sm font-medium text-slate-800 dark:text-slate-100">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{admin}</p></div></div>)}</div>
      </article>
      <article className="app-card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-100 p-5 dark:border-slate-800"><span className="grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"><Users size={21}/></span><div><h2 className="font-semibold text-slate-900 dark:text-white">{en ? 'User' : 'Người dùng'}</h2><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{en ? 'Standard account role' : 'Vai trò tài khoản thông thường'}</p></div><span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">{en ? 'Standard' : 'Thông thường'}</span></div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">{modules.map(({ icon: Icon, title, user }) => <div key={title} className="flex items-start gap-3 px-5 py-4"><span className="mt-0.5 text-slate-400"><Icon size={17}/></span><div><p className="text-sm font-medium text-slate-800 dark:text-slate-100">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{user}</p></div></div>)}</div>
      </article>
    </div>

    <div className="flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/20"><span className="mt-0.5 text-amber-700 dark:text-amber-300"><ShieldAlert size={18}/></span><div><p className="text-sm font-semibold text-amber-950 dark:text-amber-100">{en ? 'What is not configurable yet' : 'Những phần chưa thể tùy chỉnh'}</p><p className="mt-1 text-xs leading-5 text-amber-900/80 dark:text-amber-100/80">{en ? 'Creating roles, editing permissions per feature, and permission audit history are not implemented because the current backend has no corresponding permission store/API. This screen does not imply that unimplemented controls are active or change the database schema.' : 'Tạo vai trò mới, chỉnh sửa quyền theo từng chức năng và lịch sử kiểm toán quyền chưa được triển khai vì backend hiện chưa có kho dữ liệu/API tương ứng. Trang này không giả định các điều khiển chưa có là đang hoạt động và không thay đổi schema cơ sở dữ liệu.'}</p></div></div>
  </section>;
}
