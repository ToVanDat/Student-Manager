import {useCallback, useEffect, useState} from 'react';
import { Languages, QrCode, ChevronDown, ChevronUp } from 'lucide-react';
import { VN, GB } from 'country-flag-icons/react/3x2';

import { loginApi } from '@/api/authApi.js';
import { API_BASE_URL } from '@/utils/constants.js';
import LoginForm from '@/components/auth/LoginForm.jsx';
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
    const [showQrLogin, setShowQrLogin] = useState(false);
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

        setShowQrLogin(false);

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

        <div className="flex min-h-screen w-full items-center justify-center bg-linear-to-br from-slate-50 to-slate-100 p-0">

            <div className="grid min-h-screen w-full grid-cols-[55%_45%] overflow-hidden bg-white max-[1100px]:grid-cols-[52%_48%] max-[900px]:grid-cols-2 max-[800px]:flex max-[800px]:flex-col">


                {/* =================================================
                    LEFT BANNER
                ================================================= */}

                <AuthBanner />


                {/* =================================================
                    RIGHT FORM
                ================================================= */}

                <div className="flex min-h-screen items-center justify-center overflow-y-auto bg-white max-[800px]:min-h-[54vh] max-[800px]:flex-1 max-[800px]:items-start">

                    <div className="w-full max-w-[460px] px-5 py-7 min-[451px]:px-6 min-[451px]:py-8 min-[601px]:px-[30px] min-[601px]:py-[35px] min-[901px]:px-10 min-[901px]:py-[45px] min-[1101px]:p-[55px] max-[800px]:max-w-[520px]">

                        {/* LANGUAGE: grouped at the top of the form, separate from the banner */}
                        <div className="mb-6 flex items-center justify-end min-[601px]:mb-7">
                            <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm" role="group" aria-label={t('language')}>
                                <Languages size={16} aria-hidden="true" className="ml-2 mr-1 text-slate-500" />
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
                                        className={"inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 " + (language === option.value ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100')}
                                    >
                                        <option.Flag aria-hidden="true" className="shrink-0 rounded-[2px] shadow-sm" style={{ width: 18, height: 12, display: 'inline-block' }} />
                                        <span>{option.shortLabel}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* BRAND */}

                        <div className="mb-[25px] flex items-center gap-2.5 min-[451px]:mb-7 min-[601px]:mb-[35px] min-[901px]:mb-[45px]">

                            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-linear-to-br from-blue-600 to-blue-700 text-xs font-extrabold tracking-wide text-white shadow-lg shadow-blue-600/20 min-[451px]:size-[46px] min-[451px]:rounded-xl min-[451px]:text-sm">
                                SM
                            </div>


                            <div>

                                <h1 className="m-0 text-[15px] leading-[1.3] font-bold text-slate-900 min-[451px]:text-[17px]">
                                    {t('authBrandTitle')}
                                </h1>

                                <p className="mt-[3px] mb-0 text-[9px] leading-[1.3] font-medium text-slate-400 min-[451px]:text-[11px]">
                                    {t('authBrandSubtitle')}
                                </p>

                            </div>

                        </div>


                        {/* HEADING */}

                        <div className="mb-[25px] min-[451px]:mb-[30px]">

                            <h2 className="mb-2 text-2xl leading-tight font-bold text-slate-900 min-[451px]:text-[26px] min-[601px]:text-[28px] min-[901px]:text-[31px]">

                                {mode === 'login' &&
                                    t('loginHeading')}

                                {mode === 'register' &&
                                    t('registerHeading')}

                                {mode === 'forgot' &&
                                    t('forgotHeading')}

                            </h2>


                            <p className="m-0 text-xs leading-relaxed text-slate-500 min-[451px]:text-[13px]">

                                {mode === 'login' &&
                                    t('loginSubtitle')}

                                {mode === 'register' &&
                                    t('registerSubtitle')}

                                {mode === 'forgot' &&
                                    t('forgotSubtitle')}

                            </p>

                        </div>


                        {/* LOGIN */}

                        {mode === 'login' && (
                            <>
                                {renderLogin()}
                                <AdvancedLoginMethods
                                    username={username}
                                    onLogin={handleAdvancedLogin}
                                    onError={reportAdvancedLoginError}
                                    onLoading={setAdvancedLoading}
                                />
                                <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                                    <button
                                        type="button"
                                        aria-expanded={showQrLogin}
                                        aria-controls="qr-login-panel"
                                        onClick={() => setShowQrLogin((visible) => !visible)}
                                        className="group flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                    >
                                        <span className="flex items-center gap-2.5">
                                            <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300"><QrCode size={17} aria-hidden="true" /></span>
                                            <span className="text-left">Đăng nhập bằng mã QR</span>
                                        </span>
                                        {showQrLogin ? <ChevronUp size={17} aria-hidden="true" className="text-slate-400" /> : <ChevronDown size={17} aria-hidden="true" className="text-slate-400" />}
                                    </button>
                                    {showQrLogin && (
                                        <div id="qr-login-panel" className="mt-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                            <QrLoginPanel onLogin={handleAdvancedLogin} />
                                        </div>
                                    )}
                                </div>
                            </>
                        )}


                        {/* REGISTER */}

                        {mode === 'register' &&
                            renderRegister()}


                        {/* FORGOT PASSWORD */}

                        {mode === 'forgot' && (

                            <ForgotPasswordForm

                                onLogin={() =>
                                    changeMode(
                                        'login'
                                    )
                                }

                                setError={
                                    setError
                                }

                                setSuccess={
                                    setSuccess
                                }

                            />

                        )}

                    </div>

                </div>

            </div>

        </div>

    );

}


export default Login;