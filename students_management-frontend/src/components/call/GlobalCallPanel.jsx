import { useContext } from 'react';
import AuthContext from '@/context/AuthContext.jsx';
import CallPanel from '@/components/call/CallPanel.jsx';

// Mounted inside App, under LanguageProvider, so call UI uses the selected language.
export default function GlobalCallPanel() {
    const auth = useContext(AuthContext);
    if (!auth?.accessToken) return null;

    const webRTCCall = auth.webRTCCall;
    return (
        <CallPanel
            {...webRTCCall}
            targetUsername={webRTCCall?.call?.remoteUsername || 'User'}
        />
    );
}
