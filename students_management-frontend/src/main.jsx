// import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { LanguageProvider } from './context/LanguageContext.jsx';

import './styles/tailwind.css';
import './styles/reference-ui.css';
import './styles/chat-messenger-polish.css';
import './styles/call-experience.css';

createRoot(document.getElementById('root')).render(
    // <StrictMode>
        <AuthProvider>
            <LanguageProvider>
                <ThemeProvider>
                    <App />
                </ThemeProvider>
            </LanguageProvider>
        </AuthProvider>
   //  </StrictMode>
);