// import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { LanguageProvider } from './context/LanguageContext.jsx';

import './styles/tailwind.css';
import './styles/reference-ui.css';

createRoot(document.getElementById('root')).render(
    // <StrictMode>
        <LanguageProvider>
            <ThemeProvider>
                <AuthProvider>
                    <App />
                </AuthProvider>
            </ThemeProvider>
        </LanguageProvider>
   //  </StrictMode>
);