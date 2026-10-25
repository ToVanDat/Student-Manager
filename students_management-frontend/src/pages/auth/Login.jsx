import {useCallback, useEffect, useState} from 'react';
import { Languages, QrCode, ChevronDown, ChevronUp } from 'lucide-react';
import { VN, GB } from 'country-flag-icons/react/3x2';

import { loginApi, beginPasskeyLoginApi, finishPasskeyLoginApi } from '@/api/authApi.js';
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


const decodeBase64Url = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)), char => char.charCodeAt(0));
const encodeBase64Url = value => btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

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


    const handleFaceLogin = async () => {
        setError('');
        setSuccess('');
        if (!username.trim()) {
            setError(language === 'vi' ? 'Nhập username trước khi đăng nhập bằng Face ID / sinh trắc học.' : 'Enter your username before using Face ID / device biometrics.');
            return;
        }
        if (!window.isSecureContext || !navigator.credentials?.get) {
            setError(language === 'vi' ? 'Đăng nhập sinh trắc học cần HTTPS và trình duyệt hỗ trợ Passkey.' : 'Biometric sign-in requires HTTPS and a browser that supports passkeys.');
            return;
        }

        setLoading(true);
        sessionStorage.setItem('auth:login-in-progress', 'true');
        try {
            const { challengeId, options } = await beginPasskeyLoginApi(username.trim());
            const publicKey = {
                ...options,
                challenge: decodeBase64Url(options.challenge),
                allowCredentials: (options.allowCredentials || []).map(item => ({
                    ...item,
                    id: decodeBase64Url(item.id)
                }))
            };
            const credential = await navigator.credentials.get({ publicKey });
            if (!credential) throw new Error(language === 'vi' ? 'Bạn đã hủy xác minh sinh trắc học.' : 'Biometric verification was cancelled.');
            const response = {
                id: credential.id,
                rawId: encodeBase64Url(credential.rawId),
                type: credential.type,
                authenticatorAttachment: credential.authenticatorAttachment,
                response: {
                    clientDataJSON: encodeBase64Url(credential.response.clientDataJSON),
                    authenticatorData: encodeBase64Url(credential.response.authenticatorData),
                    signature: encodeBase64Url(credential.response.signature),
                    userHandle: credential.response.userHandle ? encodeBase64Url(credential.response.userHandle) : null
                },
                clientExtensionResults: credential.getClientExtensionResults()
            };
            const data = await finishPasskeyLoginApi(challengeId, response);
            loginUser(data);
            navigate('/students?view=dashboard', { replace: true });
        } catch (error) {
            setError(error.response?.data?.message || error.message || (language === 'vi' ? 'Đăng nhập sinh trắc học thất bại.' : 'Biometric sign-in failed.'));
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
            onFaceLogin={handleFaceLogin}
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
        <main className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-100 selection:text-blue-950 lg:grid lg:grid-cols-2">
            <div className="min-h-[190px] overflow-hidden p-3 sm:p-5 lg:min-h-screen lg:p-6">
                <AuthBanner />
            </div>

            <section className="flex min-h-[calc(100vh-190px)] items-center justify-center px-4 py-8 sm:px-8 sm:py-10 lg:min-h-screen lg:px-10 xl:px-14">
                <div className="absolute right-4 top-4 z-10 sm:right-8 sm:top-7 lg:right-10">
                    <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1" role="group" aria-label={t('language')}>
                        <Languages size={15} aria-hidden="true" className="ml-2 text-slate-500" />
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

                <div className="w-full max-w-[440px] rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm sm:px-8 sm:py-8 lg:px-9">
                    <div className="mb-8 flex items-center gap-3">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-sm font-bold tracking-wide text-white">
                            SM
                        </div>
                        <div>
                            <h1 className="m-0 text-base font-bold tracking-tight text-slate-950">{t('authBrandTitle')}</h1>
                            <p className="mt-1 mb-0 text-xs text-slate-500">{t('authBrandSubtitle')}</p>
                        </div>
                    </div>

                    <div className="mb-6">
                        <p className="mb-2 inline-flex text-xs font-semibold text-blue-700">
                            {mode === 'login' ? 'STUDENT MANAGER' : mode === 'register' ? 'CREATE ACCOUNT' : 'ACCOUNT RECOVERY'}
                        </p>
                        <h2 className="mb-2 text-[30px] font-extrabold tracking-[-0.04em] text-slate-950 sm:text-[36px]">
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

                    {mode === 'login' && (
                        <>
                            {renderLogin()}
                            <AdvancedLoginMethods
                                onLogin={handleAdvancedLogin}
                                onError={reportAdvancedLoginError}
                                onLoading={setAdvancedLoading}
                            />

                            <div className="mt-5 border-t border-slate-200 pt-4">
                                <button
                                    type="button"
                                    aria-expanded={showQrLogin}
                                    aria-controls="qr-login-panel"
                                    onClick={() => {
                                        setShowQrLogin(visible => !visible);
                                        setError('');
                                        setSuccess('');
                                    }}
                                    className="group flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                                >
                                    <span className="flex items-center gap-3">
                                        <span className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition group-hover:bg-blue-100 group-hover:text-blue-700">
                                            <QrCode size={18} aria-hidden="true" />
                                        </span>
                                        <span>
                                            <span className="block text-sm font-semibold text-slate-800">Đăng nhập bằng mã QR</span>
                                            <span className="mt-0.5 block text-xs font-normal text-slate-500">Xác nhận bằng điện thoại đã đăng nhập</span>
                                        </span>
                                    </span>
                                    {showQrLogin ? <ChevronUp size={17} aria-hidden="true" className="shrink-0 text-slate-400" /> : <ChevronDown size={17} aria-hidden="true" className="shrink-0 text-slate-400" />}
                                </button>
                                {showQrLogin && (
                                    <div id="qr-login-panel" className="mt-3">
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
                        />
                    )}

                    <div className="mt-7 border-t border-slate-100 pt-4 text-center text-[11px] leading-5 text-slate-400">
                        Student Manager · Secure account access
                    </div>
                </div>
            </section>
        </main>
    );
}


export default Login;