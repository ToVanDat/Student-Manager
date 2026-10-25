import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth.js';

function ProtectedRoute({ children }) {
    const {
        isAuthenticated,
        isAuthLoading,
        authRestoreError,
        retrySessionRestore
    } = useAuth();

    if (isAuthLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400" role="status" aria-live="polite">
                Đang khôi phục phiên đăng nhập…
            </div>
        );
    }

    // Do not redirect to login on a network/5xx bootstrap failure: the
    // HttpOnly refresh cookie may still represent a valid session.
    if (!isAuthenticated && authRestoreError) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
                <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <h1 className="text-base font-semibold text-slate-900 dark:text-white">
                        Chưa thể khôi phục phiên đăng nhập
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300" role="alert">
                        {authRestoreError}
                    </p>
                    <button
                        type="button"
                        onClick={retrySessionRestore}
                        className="mt-5 inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    >
                        Thử khôi phục lại
                    </button>
                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                        Bạn cũng có thể mở trang đăng nhập để sử dụng tài khoản khác.
                    </p>
                </section>
            </main>
        );
    }

    return isAuthenticated
        ? children
        : <Navigate to="/login" replace />;
}

export default ProtectedRoute;
