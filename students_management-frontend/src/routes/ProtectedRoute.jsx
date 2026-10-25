import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth.js';

function ProtectedRoute({ children }) {
    const { isAuthenticated, isAuthLoading } = useAuth();

    if (isAuthLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400" role="status" aria-live="polite">
                Đang khôi phục phiên đăng nhập…
            </div>
        );
    }

    return isAuthenticated
        ? children
        : <Navigate to="/login" replace />;
}

export default ProtectedRoute;
