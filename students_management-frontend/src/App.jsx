import { Toaster } from 'sonner';
import AppRoutes from './routes/AppRoutes.jsx';
import GlobalCallPanel from './components/call/GlobalCallPanel.jsx';

function App() {
    return (
        <>
            <Toaster position="top-right" reverseOrder={false} />
            <AppRoutes />
            <GlobalCallPanel />
        </>
    );
}

export default App;