import {
    BrowserRouter,
    Navigate,
    Route,
    Routes
} from 'react-router-dom';

import Login from '@/pages/auth/Login.jsx';
import Students from '@/pages/students/Students.jsx';
import ProtectedRoute from '@/routes/ProtectedRoute.jsx';

function AppRoutes() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                    path="/students"
                    element={
                        <ProtectedRoute>
                            <Students />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="*"
                    element={<Navigate to="/login" replace />}
                />
            </Routes>
        </BrowserRouter>
    );
}

export default AppRoutes;