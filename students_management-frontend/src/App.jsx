import {
    BrowserRouter,
    Routes,
    Route,
    Navigate
} from 'react-router-dom';

import Login from './page/login';
import Students from './page/students';

function App() {
    return (
        <BrowserRouter>
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