import { Toaster } from 'sonner';
import AppRoutes from './routes/AppRoutes.jsx';

function App() {
    return (
        <>
            <Toaster position="top-right" reverseOrder={false} />
            <AppRoutes />
        </>
    );
}

export default App;