import {
    BrowserRouter,
    Navigate,
    Route,
    Routes
} from 'react-router-dom';

import Login from '@/pages/auth/Login.jsx';
import Students from '@/pages/students/Students.jsx';
import ChatPage from '@/pages/chat/ChatPage.jsx'; 
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
                
                {/*  Thêm Route cho trang Chat */}
                <Route
                    path="/chat"
                    element={
                        <ProtectedRoute>
                            <ChatPage />
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