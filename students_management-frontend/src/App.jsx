import { useEffect } from 'react';
import { Toaster } from 'sonner';
import socket from './socket/socket.js';
import { playSound } from './services/soundService.js';
import AppRoutes from './routes/AppRoutes.jsx';
import GlobalCallPanel from './components/call/GlobalCallPanel.jsx';

function App() {
    useEffect(() => {
        const handleNotification = (notification) => {
            // The backend includes the recipient's sound preference in the
            // realtime event. Default to enabled for older payloads, but always
            // respect an explicit false value.
            if (notification?.soundEnabled !== false) {
                void playSound('notification', { volume: 0.5 });
            }
        };

        socket.on('notification:new', handleNotification);
        return () => socket.off('notification:new', handleNotification);
    }, []);

    return (
        <>
            {/* Keep transient feedback short and dismissible. Persistent
                notifications belong in the Notification Center, not in Toasts. */}
            <Toaster
                position="top-right"
                reverseOrder={false}
                duration={4000}
                closeButton
                visibleToasts={3}
                expand={false}
            />
            <AppRoutes />
            <GlobalCallPanel />
        </>
    );
}

export default App;
