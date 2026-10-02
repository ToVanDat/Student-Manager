import {
    useEffect,
    useState
} from 'react';

import { loginApi } from '@/api/authApi.js';
import { API_BASE_URL } from '@/utils/constants.js';
import LoginForm from '@/components/auth/LoginForm.jsx';
import RegisterForm from '@/components/auth/RegisterForm.jsx';
import AuthBanner from '@/components/auth/AuthBanner.jsx';

import './login.css';

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

        <div className="login-page">

            <div className="login-container">


                {/* =================================================
                    LEFT BANNER
                ================================================= */}

                <AuthBanner />


                {/* =================================================
                    RIGHT FORM
                ================================================= */}

                <div className="login-form-container">

                    <div className="login-form-wrapper">


                        {/* BRAND */}

                        <div className="login-brand">

                            <div className="login-brand-mark">
                                SM
                            </div>


                            <div className="login-brand-text">

                                <h1>
                                    Student Management
                                </h1>

                                <p>
                                    School Management System
                                </p>

                            </div>

                        </div>


                        {/* HEADING */}

                        <div className="login-heading">

                            <h2>

                                {mode === 'login' &&
                                    'Đăng nhập'}

                                {mode === 'register' &&
                                    'Tạo tài khoản'}

                                {mode === 'forgot' &&
                                    'Khôi phục mật khẩu'}

                            </h2>


                            <p>

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