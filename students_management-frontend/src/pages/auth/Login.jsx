import {useEffect, useState} from 'react';

import { loginApi } from '@/api/authApi.js';
import { API_BASE_URL } from '@/utils/constants.js';
import LoginForm from '@/components/auth/LoginForm.jsx';
import RegisterForm from '@/components/auth/RegisterForm.jsx';
import AuthBanner from '@/components/auth/AuthBanner.jsx';

import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/hooks/useAuth.js';

import ForgotPasswordForm
    from '@/components/auth/forgot-password/ForgotPasswordForm.jsx';


// =====================================================
// LOGIN COMPONENT
// =====================================================

function Login() {

    const { loginUser } = useAuth();
    const navigate = useNavigate();

    const [mode, setMode] = useState('login');
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
                'Vui lòng nhập username'
            );

            return;

        }


        if (!password) {

            setError(
                'Vui lòng nhập password'
            );

            return;

        }


        setLoading(true);


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
                'Đăng nhập thành công'
            );


            // -----------------------------------------
            // GO STUDENTS
            // -----------------------------------------

            navigate('/students');


        } catch (error) {

            console.error(
                'LOGIN ERROR:',
                error
            );


            setError(
                error.response?.data?.message ||
                error.message ||
                'Đăng nhập thất bại'
            );


        } finally {

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
                'Vui lòng nhập username'
            );

            return;

        }


        if (!email.trim()) {

            setError(
                'Vui lòng nhập email'
            );

            return;

        }


        if (!password) {

            setError(
                'Vui lòng nhập password'
            );

            return;

        }


        if (!confirmPassword) {

            setError(
                'Vui lòng xác nhận password'
            );

            return;

        }


        if (
            password !==
            confirmPassword
        ) {

            setError(
                'Mật khẩu xác nhận không khớp'
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
                    'Đăng ký thất bại'
                );

            }


            // -----------------------------------------
            // SUCCESS
            // -----------------------------------------

            setSuccess(
                data.message ||
                'Đăng ký thành công'
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
                'Đăng ký thất bại'
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


                        {/* BRAND */}

                        <div className="mb-[25px] flex items-center gap-2.5 min-[451px]:mb-7 min-[601px]:mb-[35px] min-[901px]:mb-[45px]">

                            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-linear-to-br from-blue-600 to-blue-700 text-xs font-extrabold tracking-wide text-white shadow-lg shadow-blue-600/20 min-[451px]:size-[46px] min-[451px]:rounded-xl min-[451px]:text-sm">
                                SM
                            </div>


                            <div>

                                <h1 className="m-0 text-[15px] leading-[1.3] font-bold text-slate-900 min-[451px]:text-[17px]">
                                    Student Management
                                </h1>

                                <p className="mt-[3px] mb-0 text-[9px] leading-[1.3] font-medium text-slate-400 min-[451px]:text-[11px]">
                                    School Management System
                                </p>

                            </div>

                        </div>


                        {/* HEADING */}

                        <div className="mb-[25px] min-[451px]:mb-[30px]">

                            <h2 className="mb-2 text-2xl leading-tight font-bold text-slate-900 min-[451px]:text-[26px] min-[601px]:text-[28px] min-[901px]:text-[31px]">

                                {mode === 'login' &&
                                    'Đăng nhập'}

                                {mode === 'register' &&
                                    'Tạo tài khoản'}

                                {mode === 'forgot' &&
                                    'Khôi phục mật khẩu'}

                            </h2>


                            <p className="m-0 text-xs leading-relaxed text-slate-500 min-[451px]:text-[13px]">

                                {mode === 'login' &&
                                    'Đăng nhập vào hệ thống quản lý sinh viên'}

                                {mode === 'register' &&
                                    'Đăng ký tài khoản mới để sử dụng hệ thống'}

                                {mode === 'forgot' &&
                                    'Xác thực email để đặt lại mật khẩu'}

                            </p>

                        </div>


                        {/* LOGIN */}

                        {mode === 'login' &&
                            renderLogin()}


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