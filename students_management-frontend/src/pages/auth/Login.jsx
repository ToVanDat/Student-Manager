import {useCallback, useEffect, useState} from 'react';
import { Languages, QrCode, ChevronDown, ChevronUp, Camera } from 'lucide-react';
import { VN, GB } from 'country-flag-icons/react/3x2';

import { loginApi } from '@/api/authApi.js';
import { API_BASE_URL } from '@/utils/constants.js';
import LoginForm from '@/components/auth/LoginForm.jsx';
import FaceLoginCapture from '@/components/auth/FaceLoginCapture.jsx';
import AdvancedLoginMethods from '@/components/auth/AdvancedLoginMethods.jsx';
import QrLoginPanel from '@/components/auth/QrLoginPanel.jsx';
import RegisterForm from '@/components/auth/RegisterForm.jsx';
import AuthBanner from '@/components/auth/AuthBanner.jsx';

import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/hooks/useAuth.js';
import { useLanguage } from '@/context/LanguageContext.jsx';

import ForgotPasswordForm
    from '@/components/auth/forgot-password/ForgotPasswordForm.jsx';


// =====================================================
// LOGIN COMPONENT
// =====================================================

function Login() {

    const { loginUser } = useAuth();
    const { language, setLanguage, t } = useLanguage();
    const navigate = useNavigate();

    const [mode, setMode] = useState('login');
    const [showMoreLoginOptions, setShowMoreLoginOptions] = useState(false);
    const [showFaceLogin, setShowFaceLogin] = useState(false);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');


    const [showPassword, setShowPassword] =
        useState(false);

    const [showConfirmPassword, setShowConfirmPassword] =
        useState(false);


    // =================================================
    // REMEMBER ACCOUNT
    // =================================================

    const [rememberMe, setRememberMe] = useState(
        () => {
            return (
                localStorage.getItem(
                    'rememberMe'
                ) === 'true'
            );
        }
    );


    // =================================================
    // MESSAGE
    // =================================================

    const [error, setError] =
        useState('');

    const [success, setSuccess] =
        useState('');


    // =================================================
    // LOADING
    // =================================================

    const [loading, setLoading] =
        useState(false);


    // =================================================
    // LOAD REMEMBERED USERNAME
    // =================================================

    useEffect(() => {

        const savedUsername =
            localStorage.getItem(
                'rememberedUsername'
            );

        if (savedUsername) {

            setUsername(savedUsername);

        }

    }, []);



    // =================================================
    // CHANGE MODE
    // =================================================

    const changeMode = (newMode) => {

        setMode(newMode);

        setShowMoreLoginOptions(false);

        setError('');

        setSuccess('');

        setShowPassword(false);

        setShowConfirmPassword(false);

    };


    // =================================================
    // LOGIN
    // =================================================

    const handleLogin = async (event) => {

        event.preventDefault();


        setError('');

        setSuccess('');


        // ---------------------------------------------
        // VALIDATION
        // ---------------------------------------------

        if (!username.trim()) {

            setError(
                t('enterUsername')
            );

            return;

        }


        if (!password) {

            setError(
                t('enterPassword')
            );

            return;

        }


        setLoading(true);
        // Mark this tab as intentionally replacing its previous session.
        // sessionStorage is tab-scoped, unlike localStorage, so other devices
        // and tabs still process their own session-revoked event.
        sessionStorage.setItem('auth:login-in-progress', 'true');

        try {

            // -----------------------------------------
            // CALL API
            // -----------------------------------------

            const data =
                await loginApi(
                    username.trim(),
                    password
                );


            // -----------------------------------------
            // SAVE AUTH STATE
            // -----------------------------------------

            loginUser(data);


            // -----------------------------------------
            // REMEMBER ACCOUNT
            // -----------------------------------------

            if (rememberMe) {

                localStorage.setItem(
                    'rememberedUsername',
                    username.trim()
                );

                localStorage.setItem(
                    'rememberMe',
                    'true'
                );

            } else {

                localStorage.removeItem(
                    'rememberedUsername'
                );

                localStorage.removeItem(
                    'rememberMe'
                );

            }


            // -----------------------------------------
            // SUCCESS
            // -----------------------------------------

            setSuccess(
                data.message ||
                t('loginSuccess')
            );


            // -----------------------------------------
            // GO STUDENTS
            // -----------------------------------------

            navigate(data.user?.role === 'admin' ? '/students?view=dashboard' : '/students?view=dashboard', { replace: true });


        } catch (error) {

            console.error(
                'LOGIN ERROR:',
                error
            );


            setError(
                error.response?.data?.message ||
                error.message ||
                t('loginFailed')
            );


        } finally {
            sessionStorage.removeItem('auth:login-in-progress');
            setLoading(false);
        }

    };


    const handleFaceLogin = () => {
        setError('');
        setSuccess('');
        if (!username.trim()) {
            setError(language === 'vi'
                ? 'Nhập username trước khi đăng nhập bằng Face Login.'
                : 'Enter your username before using Face Login.');
            return;
        }
        setShowFaceLogin(true);
    };

    const handleFaceLoginSuccess = data => {
        // Match password login: ignore stale-session revoke events while this
        // tab intentionally replaces its current session with Face Login.
        sessionStorage.setItem('auth:login-in-progress', 'true');
        try {
            loginUser(data);
            setShowFaceLogin(false);
            navigate('/students?view=dashboard', { replace: true });
        } finally {
            sessionStorage.removeItem('auth:login-in-progress');
        }
    };

    // =================================================
    // REGISTER
    // =================================================

    const handleRegister = async (event) => {

        event.preventDefault();


        setError('');

        setSuccess('');


        // ---------------------------------------------
        // VALIDATION
        // ---------------------------------------------

        if (!username.trim()) {

            setError(
                t('enterUsername')
            );

            return;

        }


        if (!email.trim()) {

            setError(
                t('enterEmail')
            );

            return;

        }


        if (!password) {

            setError(
                t('enterPassword')
            );

            return;

        }


        if (!confirmPassword) {

            setError(
                t('confirmPasswordRequired')
            );

            return;

        }


        if (
            password !==
            confirmPassword
        ) {

            setError(
                t('passwordMismatch')
            );

            return;

        }


        setLoading(true);


        try {

            // -----------------------------------------
            // REGISTER API
            // -----------------------------------------

            const response =
                await fetch(
                    `${API_BASE_URL}/api/auth/register`,
                    {
                        method: 'POST',

                        headers: {
                            'Content-Type':
                                'application/json'
                        },

                        body: JSON.stringify({

                            username:
                                username.trim(),

                            email:
                                email
                                    .trim()
                                    .toLowerCase(),

                            password

                        })
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.message ||
                    t('registerFailed')
                );

            }


            // -----------------------------------------
            // SUCCESS
            // -----------------------------------------

            setSuccess(
                data.message ||
                t('registerSuccess')
            );


            // -----------------------------------------
            // CLEAR FORM
            // -----------------------------------------

            setUsername('');

            setEmail('');

            setPassword('');

            setConfirmPassword('');

            setShowPassword(false);

            setShowConfirmPassword(false);


            // -----------------------------------------
            // BACK TO LOGIN
            // -----------------------------------------

            setTimeout(() => {

                setMode('login');

                setSuccess('');

            }, 1500);


        } catch (error) {

            console.error(
                'REGISTER ERROR:',
                error
            );


            setError(
                error.message ||
                t('registerFailed')
            );


        } finally {

            setLoading(false);

        }

    };


    // =================================================
    // LOGIN FORM
    // =================================================

    const renderLogin = () => (
        <LoginForm
            username={username}
            onUsernameChange={setUsername}
            password={password}
            onPasswordChange={setPassword}
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword((visible) => !visible)}
            rememberMe={rememberMe}
            onRememberChange={setRememberMe}
            onForgotPassword={() => changeMode('forgot')}
            error={error}
            success={success}
            loading={loading}
            onSubmit={handleLogin}
            onOpenRegister={() => changeMode('register')}
        />
    );


    const handleAdvancedLogin = useCallback((data) => {
        loginUser(data);
        navigate('/students?view=dashboard', { replace: true });
    }, [loginUser, navigate]);

    const reportAdvancedLoginError = useCallback((message) => {
        setError(message);
    }, []);

    const setAdvancedLoading = useCallback((value) => {
        setLoading(value);
    }, []);

    // =================================================
    // REGISTER FORM
    // =================================================

    const renderRegister = () => (
        <RegisterForm
            username={username}
            onUsernameChange={setUsername}
            email={email}
            onEmailChange={setEmail}
            password={password}
            onPasswordChange={setPassword}
            confirmPassword={confirmPassword}
            onConfirmPasswordChange={setConfirmPassword}
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword((visible) => !visible)}
            showConfirmPassword={showConfirmPassword}
            onToggleConfirmPassword={() => setShowConfirmPassword((visible) => !visible)}
            error={error}
            success={success}
            loading={loading}
            onSubmit={handleRegister}
            onBackToLogin={() => changeMode('login')}
        />
    );


    // =================================================
    // RENDER
    // =================================================

    return (
        <main data-ui-page="auth-login" className="auth-login-page relative min-h-[100svh] overflow-x-hidden bg-[#f5f7fb] text-slate-900 selection:bg-blue-100 selection:text-blue-950 min-[801px]:grid min-[801px]:grid-cols-[minmax(0,0.92fr)_minmax(480px,1.08fr)]">
            <div className="hidden min-[801px]:block min-[801px]:min-h-[100svh] min-[801px]:overflow-hidden min-[801px]:p-4 xl:p-5">
                <AuthBanner />
            </div>

            <section aria-labelledby="auth-title" className="relative flex min-h-[100svh] items-center justify-center px-4 pb-8 pt-16 sm:px-8 sm:pb-12 min-[801px]:min-h-[100svh] min-[801px]:px-10 min-[801px]:py-16 xl:px-16">
                <div className="absolute right-4 top-4 z-20 sm:right-8 sm:top-6 lg:right-8 xl:right-12">
                    <div className="inline-flex items-center gap-1 rounded-full border border-slate-200/90 bg-white/95 p-1 shadow-sm backdrop-blur" role="group" aria-label={t('language')}>
                        <Languages size={14} aria-hidden="true" className="ml-2 text-slate-400" />
                        {[
                            { value: 'vi', label: 'Tiếng Việt', shortLabel: 'VI', Flag: VN },
                            { value: 'en', label: 'English', shortLabel: 'EN', Flag: GB },
                        ].map(option => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setLanguage(option.value)}
                                aria-pressed={language === option.value}
                                aria-label={option.label}
                                title={option.label}
                                className={"inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 " + (language === option.value ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100')}
                            >
                                <option.Flag aria-hidden="true" className="shrink-0 rounded-[2px]" style={{ width: 17, height: 11 }} />
                                <span>{option.shortLabel}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div data-auth-motion className="auth-login-card w-full max-w-[460px] rounded-[28px] bg-white px-5 py-6 shadow-[0_18px_60px_-35px_rgba(15,23,42,.28)] sm:px-9 sm:py-9 min-[801px]:px-10">
                    <div className="auth-brand-row mb-7 flex items-center gap-3 sm:mb-9">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-sm font-bold tracking-wide text-white">
                            SM
                        </div>
                        <div>
                            <h1 className="m-0 text-base font-bold tracking-tight text-slate-950">{t('authBrandTitle')}</h1>
                            <p className="mt-1 mb-0 text-xs text-slate-500">{t('authBrandSubtitle')}</p>
                        </div>
                    </div>

                    <div className="auth-heading mb-6">
                        <p className="mb-2 inline-flex text-xs font-semibold text-blue-700">
                            {mode === 'login' ? t('authModeLogin') : mode === 'register' ? t('authModeRegister') : t('authModeRecovery')}
                        </p>
                        <h2 id="auth-title" className="mb-2 text-[30px] font-extrabold tracking-[-0.04em] text-slate-950 sm:text-[36px]">
                            {mode === 'login' && t('loginHeading')}
                            {mode === 'register' && t('registerHeading')}
                            {mode === 'forgot' && t('forgotHeading')}
                        </h2>
                        <p className="m-0 text-sm leading-6 text-slate-500">
                            {mode === 'login' && t('loginSubtitle')}
                            {mode === 'register' && t('registerSubtitle')}
                            {mode === 'forgot' && t('forgotSubtitle')}
                        </p>
                    </div>

                    <div key={mode} id="auth-mode-panel" data-auth-mode={mode} aria-live="polite" aria-busy={loading} className="auth-mode-panel">
                    {mode === 'login' && (
                        <>
                            {renderLogin()}
                            <div className="mt-4 border-t border-slate-200 pt-3">
                                <button
                                    type="button"
                                    aria-expanded={showMoreLoginOptions}
                                    aria-controls="more-login-options"
                                    onClick={() => {
                                        setShowMoreLoginOptions(visible => !visible);
                                        setError('');
                                        setSuccess('');
                                    }}
                                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-2 text-left text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                                >
                                    <span className="flex items-center gap-2">
                                        <QrCode size={17} aria-hidden="true" />
                                        {language === 'vi' ? 'Phương thức đăng nhập khác' : 'More sign-in options'}
                                    </span>
                                    {showMoreLoginOptions ? <ChevronUp size={17} aria-hidden="true" /> : <ChevronDown size={17} aria-hidden="true" />}
                                </button>
                                {showMoreLoginOptions && (
                                    <div id="more-login-options" className="mt-2 space-y-3">
                                        <button
                                            type="button"
                                            onClick={handleFaceLogin}
                                            disabled={loading || !username.trim()}
                                            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <Camera size={17} aria-hidden="true" />
                                            {t('faceLoginAction')}
                                        </button>
                                        <AdvancedLoginMethods
                                            onLogin={handleAdvancedLogin}
                                            onError={reportAdvancedLoginError}
                                            onLoading={setAdvancedLoading}
                                        />
                                        <QrLoginPanel onLogin={handleAdvancedLogin} />
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {mode === 'register' && renderRegister()}

                    {mode === 'forgot' && (
                        <ForgotPasswordForm
                            onLogin={() => changeMode('login')}
                            setError={setError}
                            setSuccess={setSuccess}
                            error={error}
                            success={success}
                        />
                    )}
                    </div>

                    <div className="mt-7 border-t border-slate-100 pt-4 text-center text-[11px] leading-5 text-slate-400">
                        Student Manager · Secure account access
                    </div>
                    {showFaceLogin && (
                        <FaceLoginCapture
                            username={username.trim()}
                            onClose={() => setShowFaceLogin(false)}
                            onSuccess={handleFaceLoginSuccess}
                        />
                    )}
                </div>
            </section>
        </main>
    );
}


export default Login;