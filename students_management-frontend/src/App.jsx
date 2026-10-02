import {
    BrowserRouter,
    Routes,
    Route,
    Navigate
} from 'react-router-dom';

import Login from './page/login';
import Students from './page/students';
import { Toaster } from 'sonner';
function App() {
    return (
        <BrowserRouter>
        <Toaster position="top-right" reverseOrder={false} />
            <Routes>

                <Route
                    path="/login"
                    element={<Login />}
                />

                <Route
                    path="/students"
                    element={<Students />}
                />

                <Route
                    path="*"
                    element={
                        <Navigate
                            to="/login"
                            replace
                        />
                    }
                />

            </Routes>
        </BrowserRouter>
    );
}

export default App;