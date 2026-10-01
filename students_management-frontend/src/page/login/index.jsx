import {
    useEffect,
    useState,
    useRef
} from 'react';

import {
    Eye,
    EyeOff
} from 'lucide-react';

import { loginApi } from '../../service/authApi';

import './login.css';

import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../auth/useAuth.js';

import ForgotPasswordForm
    from './ForgotPasswordForm.jsx';


// =====================================================
// BANNER DATA
// =====================================================

const banners = [
    {
        image: '/login-campus.jpg',

        badge: 'STUDENT MANAGEMENT SYSTEM',

        title: 'Student Management',

        description:
            'Hệ thống quản lý thông tin sinh viên và dữ liệu đào tạo của nhà trường.'
    },

    {
        image: '/login-classroom.jpg',

        badge: 'ACADEMIC MANAGEMENT',

        title: 'Quản lý đào tạo',

        description:
            'Quản lý lớp học, môn học, học kỳ và thông tin đào tạo một cách tập trung.'
    },

    {
        image: '/login-library.jpg',

        badge: 'STUDENT SERVICES',

        title: 'Kết nối sinh viên',

        description:
            'Tổ chức và quản lý dữ liệu sinh viên nhanh chóng, chính xác và hiệu quả.'
    }
];


// =====================================================
// LOGIN COMPONENT
// =====================================================

function Login() {

    // =================================================
    // AUTH
    // =================================================

    const { loginUser } = useAuth();

    const navigate = useNavigate();


    // =================================================
    // MODE
    // login
    // register
    // forgot
    // =================================================

    const [mode, setMode] =
        useState('login');


    // =================================================
    // FORM DATA
    // =================================================

    const [username, setUsername] =
        useState('');

    const [email, setEmail] =
        useState('');

    const [password, setPassword] =
        useState('');

    const [confirmPassword, setConfirmPassword] =
        useState('');


    // =================================================
    // PASSWORD VISIBILITY
    // =================================================

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
    // BANNER
    // =================================================

    const [currentBanner, setCurrentBanner] =
        useState(0);


    // =================================================
    // TOUCH / SWIPE
    // =================================================

    const touchStartX =
        useRef(null);

    const touchEndX =
        useRef(null);


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
    // AUTO BANNER
    //
    // Mỗi khi banner thay đổi,
    // timer được reset lại 5 giây.
    // =================================================

    useEffect(() => {

        const timer = setInterval(() => {

            setCurrentBanner(
                previous =>
                    (previous + 1) %
                    banners.length
            );

        }, 5000);


        return () => {

            clearInterval(timer);

        };

    }, [currentBanner]);


    // =================================================
    // CHANGE BANNER
    // =================================================

    const goToBanner = (index) => {

        setCurrentBanner(index);

    };


    // =================================================
    // NEXT
    // =================================================

    const nextBanner = () => {

        setCurrentBanner(
            previous =>
                (previous + 1) %
                banners.length
        );

    };


    // =================================================
    // PREVIOUS
    // =================================================

    const previousBanner = () => {

        setCurrentBanner(
            previous =>
                (
                    previous -
                    1 +
                    banners.length
                ) %
                banners.length
        );

    };


    // =================================================
    // TOUCH START
    // =================================================

    const handleTouchStart = (event) => {

        touchStartX.current =
            event.touches[0].clientX;

        touchEndX.current = null;

    };


    // =================================================
    // TOUCH MOVE
    // =================================================

    const handleTouchMove = (event) => {

        touchEndX.current =
            event.touches[0].clientX;

    };


    // =================================================
    // TOUCH END
    // =================================================

    const handleTouchEnd = () => {

        if (
            touchStartX.current === null ||
            touchEndX.current === null
        ) {

            return;

        }


        const distance =
            touchStartX.current -
            touchEndX.current;


        const minimumSwipe = 50;


        if (
            Math.abs(distance) <
            minimumSwipe
        ) {

            return;

        }


        if (distance > 0) {

            nextBanner();

        } else {

            previousBanner();

        }


        touchStartX.current = null;

        touchEndX.current = null;

    };


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
                    'http://localhost:3000/api/auth/register',
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

    const renderLogin = () => {

        return (

            <form
                className="login-form"
                onSubmit={handleLogin}
            >

                {/* USERNAME */}

                <div className="login-field">

                    <label>
                        Username
                    </label>

                    <input
                        type="text"

                        value={username}

                        onChange={(event) =>
                            setUsername(
                                event.target.value
                            )
                        }

                        placeholder="Nhập username"

                        autoComplete="username"
                    />

                </div>


                {/* PASSWORD */}

                <div className="login-field">

                    <label>
                        Password
                    </label>


                    <div className="password-wrapper">

                        <input
                            type={
                                showPassword
                                    ? 'text'
                                    : 'password'
                            }

                            value={password}

                            onChange={(event) =>
                                setPassword(
                                    event.target.value
                                )
                            }

                            placeholder="Nhập password"

                            autoComplete="current-password"
                        />


                        <button
                            type="button"

                            className="password-toggle"

                            onClick={() =>
                                setShowPassword(
                                    previous =>
                                        !previous
                                )
                            }

                            aria-label={
                                showPassword
                                    ? 'Ẩn mật khẩu'
                                    : 'Hiện mật khẩu'
                            }
                        >

                            {showPassword ? (

                                <EyeOff
                                    size={18}
                                    strokeWidth={1.8}
                                />

                            ) : (

                                <Eye
                                    size={18}
                                    strokeWidth={1.8}
                                />

                            )}

                        </button>

                    </div>

                </div>


                {/* REMEMBER */}

                <div className="remember-row">

                    <label className="remember-label">

                        <input
                            type="checkbox"

                            checked={rememberMe}

                            onChange={(event) =>
                                setRememberMe(
                                    event.target.checked
                                )
                            }
                        />

                        <span className="remember-check" />

                        <span>
                            Ghi nhớ tài khoản
                        </span>

                    </label>


                    <button
                        type="button"

                        className="forgot-link"

                        onClick={() =>
                            changeMode('forgot')
                        }
                    >
                        Quên mật khẩu?
                    </button>

                </div>


                {/* ERROR */}

                {error && (

                    <div className="login-error">

                        {error}

                    </div>

                )}


                {/* SUCCESS */}

                {success && (

                    <div className="login-success">

                        {success}

                    </div>

                )}


                {/* LOGIN BUTTON */}

                <button
                    className="login-button"

                    type="submit"

                    disabled={loading}
                >

                    {loading
                        ? 'Đang đăng nhập...'
                        : 'Đăng nhập'}

                </button>


                {/* REGISTER */}

                <div className="login-links">

                    <span>
                        Chưa có tài khoản?
                    </span>

                    <button
                        type="button"

                        onClick={() =>
                            changeMode(
                                'register'
                            )
                        }
                    >
                        Tạo tài khoản
                    </button>

                </div>

            </form>

        );

    };


    // =================================================
    // REGISTER FORM
    // =================================================

    const renderRegister = () => {

        return (

            <form
                className="login-form"
                onSubmit={handleRegister}
            >

                {/* USERNAME */}

                <div className="login-field">

                    <label>
                        Username
                    </label>

                    <input
                        type="text"

                        value={username}

                        onChange={(event) =>
                            setUsername(
                                event.target.value
                            )
                        }

                        placeholder="Nhập username"

                        autoComplete="username"
                    />

                </div>


                {/* EMAIL */}

                <div className="login-field">

                    <label>
                        Email
                    </label>

                    <input
                        type="email"

                        value={email}

                        onChange={(event) =>
                            setEmail(
                                event.target.value
                            )
                        }

                        placeholder="you@example.com"

                        autoComplete="email"
                    />

                </div>


                {/* PASSWORD */}

                <div className="login-field">

                    <label>
                        Password
                    </label>


                    <div className="password-wrapper">

                        <input
                            type={
                                showPassword
                                    ? 'text'
                                    : 'password'
                            }

                            value={password}

                            onChange={(event) =>
                                setPassword(
                                    event.target.value
                                )
                            }

                            placeholder="Nhập password"

                            autoComplete="new-password"
                        />


                        <button
                            type="button"

                            className="password-toggle"

                            onClick={() =>
                                setShowPassword(
                                    previous =>
                                        !previous
                                )
                            }

                            aria-label={
                                showPassword
                                    ? 'Ẩn mật khẩu'
                                    : 'Hiện mật khẩu'
                            }
                        >

                            {showPassword ? (

                                <EyeOff
                                    size={18}
                                    strokeWidth={1.8}
                                />

                            ) : (

                                <Eye
                                    size={18}
                                    strokeWidth={1.8}
                                />

                            )}

                        </button>

                    </div>

                </div>


                {/* CONFIRM PASSWORD */}

                <div className="login-field">

                    <label>
                        Confirm Password
                    </label>


                    <div className="password-wrapper">

                        <input
                            type={
                                showConfirmPassword
                                    ? 'text'
                                    : 'password'
                            }

                            value={confirmPassword}

                            onChange={(event) =>
                                setConfirmPassword(
                                    event.target.value
                                )
                            }

                            placeholder="Nhập lại password"

                            autoComplete="new-password"
                        />


                        <button
                            type="button"

                            className="password-toggle"

                            onClick={() =>
                                setShowConfirmPassword(
                                    previous =>
                                        !previous
                                )
                            }

                            aria-label={
                                showConfirmPassword
                                    ? 'Ẩn mật khẩu'
                                    : 'Hiện mật khẩu'
                            }
                        >

                            {showConfirmPassword ? (

                                <EyeOff
                                    size={18}
                                    strokeWidth={1.8}
                                />

                            ) : (

                                <Eye
                                    size={18}
                                    strokeWidth={1.8}
                                />

                            )}

                        </button>

                    </div>

                </div>


                {/* ERROR */}

                {error && (

                    <div className="login-error">

                        {error}

                    </div>

                )}


                {/* SUCCESS */}

                {success && (

                    <div className="login-success">

                        {success}

                    </div>

                )}


                {/* REGISTER BUTTON */}

                <button
                    className="login-button"

                    type="submit"

                    disabled={loading}
                >

                    {loading
                        ? 'Đang đăng ký...'
                        : 'Tạo tài khoản'}

                </button>


                {/* BACK LOGIN */}

                <div className="login-links">

                    <button
                        type="button"

                        onClick={() =>
                            changeMode('login')
                        }
                    >
                        ← Quay lại đăng nhập
                    </button>

                </div>

            </form>

        );

    };


    // =================================================
    // CURRENT BANNER
    // =================================================

    const banner =
        banners[currentBanner];


    // =================================================
    // RENDER
    // =================================================

    return (

        <div className="login-page">

            <div className="login-container">


                {/* =================================================
                    LEFT BANNER
                ================================================= */}

                <div
                    className="login-banner"

                    onTouchStart={
                        handleTouchStart
                    }

                    onTouchMove={
                        handleTouchMove
                    }

                    onTouchEnd={
                        handleTouchEnd
                    }
                >


                    {/* IMAGE */}

                    <div
                        key={currentBanner}

                        className="login-banner-slide active"

                        style={{
                            backgroundImage:
                                `url("${banner.image}")`
                        }}
                    />


                    {/* OVERLAY */}

                    <div className="login-banner-overlay" />


                    {/* CONTENT */}

                    <div className="login-banner-content">

                        <div className="banner-badge">

                            {banner.badge}

                        </div>


                        <h2>
                            {banner.title}
                        </h2>


                        <p>
                            {banner.description}
                        </p>


                        <div className="banner-line" />


                        <div className="banner-info">

                            <div className="banner-info-item">

                                <strong>
                                    01
                                </strong>

                                <span>
                                    Quản lý sinh viên
                                </span>

                            </div>


                            <div className="banner-info-item">

                                <strong>
                                    02
                                </strong>

                                <span>
                                    Quản lý lớp học
                                </span>

                            </div>


                            <div className="banner-info-item">

                                <strong>
                                    03
                                </strong>

                                <span>
                                    Quản lý đào tạo
                                </span>

                            </div>

                        </div>

                    </div>


                    {/* PREVIOUS */}

                    <button
                        type="button"

                        className="
                            banner-arrow
                            banner-arrow-left
                        "

                        onClick={
                            previousBanner
                        }

                        aria-label="Banner trước"
                    >
                        ‹
                    </button>


                    {/* NEXT */}

                    <button
                        type="button"

                        className="
                            banner-arrow
                            banner-arrow-right
                        "

                        onClick={
                            nextBanner
                        }

                        aria-label="Banner tiếp theo"
                    >
                        ›
                    </button>


                    {/* INDICATORS */}

                    <div className="login-banner-indicators">

                        {banners.map(
                            (_, index) => (

                                <button
                                    key={index}

                                    type="button"

                                    className={
                                        index ===
                                        currentBanner
                                            ? 'active'
                                            : ''
                                    }

                                    onClick={() =>
                                        goToBanner(
                                            index
                                        )
                                    }

                                    aria-label={
                                        `Chuyển đến banner ${index + 1}`
                                    }
                                />

                            )
                        )}

                    </div>


                    {/* SWIPE */}

                    <div className="banner-swipe-hint">

                        ← Kéo để chuyển →

                    </div>

                </div>


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