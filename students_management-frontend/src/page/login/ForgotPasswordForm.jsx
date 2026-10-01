import { useEffect, useState } from 'react';

import {
    forgotPasswordApi,
    verifyResetOtpApi,
    resetPasswordApi
} from '../../service/authApi.js';


// =====================================================
// FORGOT PASSWORD FORM
// =====================================================

function ForgotPasswordForm({
    onLogin,
    setError,
    setSuccess
}) {

    // =====================================================
    // STEP
    // =====================================================

    const [step, setStep] = useState('email');


    // =====================================================
    // FORM DATA
    // =====================================================

    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');

    const [newPassword, setNewPassword] =
        useState('');

    const [confirmPassword, setConfirmPassword] =
        useState('');


    // =====================================================
    // RESET TOKEN
    // =====================================================

    const [resetToken, setResetToken] =
        useState('');


    // =====================================================
    // LOADING
    // =====================================================

    const [loading, setLoading] =
        useState(false);


    // =====================================================
    // RESEND OTP COOLDOWN
    // =====================================================

    const [resendCooldown, setResendCooldown] =
        useState(0);


    // =====================================================
    // OTP COOLDOWN TIMER
    // =====================================================

    useEffect(() => {

        if (resendCooldown <= 0) {
            return;
        }

        const timer = setInterval(() => {

            setResendCooldown((previous) => {

                if (previous <= 1) {
                    return 0;
                }

                return previous - 1;
            });

        }, 1000);


        return () => {
            clearInterval(timer);
        };

    }, [resendCooldown]);


    // =====================================================
    // STEP 1
    // SEND OTP
    // =====================================================

    const handleSendOtp = async (event) => {

        event.preventDefault();


        // ---------------------------------------------
        // CLEAR MESSAGE
        // ---------------------------------------------

        setError('');
        setSuccess('');


        // ---------------------------------------------
        // NORMALIZE EMAIL
        // ---------------------------------------------

        const normalizedEmail =
            email.trim().toLowerCase();


        // ---------------------------------------------
        // VALIDATE EMAIL
        // ---------------------------------------------

        if (!normalizedEmail) {

            setError(
                'Vui lòng nhập email'
            );

            return;
        }


        // ---------------------------------------------
        // LOADING
        // ---------------------------------------------

        setLoading(true);


        try {

            const data =
                await forgotPasswordApi(
                    normalizedEmail
                );


            console.log(
                'FORGOT PASSWORD:',
                data
            );


            // -----------------------------------------
            // SAVE NORMALIZED EMAIL
            // -----------------------------------------

            setEmail(normalizedEmail);


            // -----------------------------------------
            // SUCCESS MESSAGE
            // -----------------------------------------

            setSuccess(
                data.message ||
                'Mã OTP đã được gửi đến email của bạn.'
            );


            // -----------------------------------------
            // MOVE TO OTP STEP
            // -----------------------------------------

            setStep('otp');


            // -----------------------------------------
            // START RESEND COOLDOWN
            // -----------------------------------------

            setResendCooldown(60);


        } catch (error) {

            console.error(
                'FORGOT PASSWORD ERROR:',
                error
            );


            const message =
                error.response?.data?.message ||
                'Không thể xử lý yêu cầu';


            setError(message);


        } finally {

            setLoading(false);
        }
    };


    // =====================================================
    // STEP 2
    // VERIFY OTP
    // =====================================================

    const handleVerifyOtp = async (event) => {

        event.preventDefault();


        console.log(
            '========== VERIFY OTP START =========='
        );

        console.log(
            'Email:',
            email
        );

        console.log(
            'OTP:',
            otp
        );


        // ---------------------------------------------
        // CLEAR MESSAGE
        // ---------------------------------------------

        setError('');
        setSuccess('');


        // ---------------------------------------------
        // VALIDATE OTP EMPTY
        // ---------------------------------------------

        if (!otp.trim()) {

            console.log(
                'OTP EMPTY'
            );

            setError(
                'Vui lòng nhập mã OTP'
            );

            return;
        }


        // ---------------------------------------------
        // VALIDATE OTP FORMAT
        // ---------------------------------------------

        if (!/^\d{6}$/.test(otp)) {

            console.log(
                'OTP INVALID FORMAT:',
                otp
            );

            setError(
                'Mã OTP phải gồm 6 số'
            );

            return;
        }


        // ---------------------------------------------
        // LOADING
        // ---------------------------------------------

        setLoading(true);


        try {

            console.log(
                'Calling verifyResetOtpApi...'
            );


            const data =
                await verifyResetOtpApi(
                    email.trim().toLowerCase(),
                    otp
                );


            console.log(
                'VERIFY OTP RESPONSE:',
                data
            );


            // -----------------------------------------
            // CHECK RESET TOKEN
            // -----------------------------------------

            if (!data?.resetToken) {

                console.error(
                    'Không có resetToken:',
                    data
                );

                setError(
                    'Xác thực OTP thành công nhưng không nhận được reset token'
                );

                return;
            }


            // -----------------------------------------
            // SAVE RESET TOKEN
            // -----------------------------------------

            setResetToken(
                data.resetToken
            );


            // -----------------------------------------
            // SUCCESS MESSAGE
            // -----------------------------------------

            setSuccess(
                data.message ||
                'Xác thực OTP thành công.'
            );


            // -----------------------------------------
            // MOVE TO RESET PASSWORD
            // -----------------------------------------

            console.log(
                'Changing step: otp -> reset'
            );

            setStep('reset');


            console.log(
                '========== VERIFY OTP SUCCESS =========='
            );


        } catch (error) {

            console.error(
                '========== VERIFY OTP ERROR =========='
            );

            console.error(
                error
            );

            console.error(
                'Response:',
                error.response?.data
            );


            setError(
                error.response?.data?.message ||
                'Mã OTP không hợp lệ'
            );


        } finally {

            setLoading(false);
        }
    };


    // =====================================================
    // RESEND OTP
    // =====================================================

    const handleResendOtp = async () => {

        // ---------------------------------------------
        // PREVENT SPAM
        // ---------------------------------------------

        if (loading) {
            return;
        }


        // ---------------------------------------------
        // CHECK COOLDOWN
        // ---------------------------------------------

        if (resendCooldown > 0) {

            return;
        }


        // ---------------------------------------------
        // CLEAR MESSAGE
        // ---------------------------------------------

        setError('');
        setSuccess('');


        // ---------------------------------------------
        // NORMALIZE EMAIL
        // ---------------------------------------------

        const normalizedEmail =
            email.trim().toLowerCase();


        if (!normalizedEmail) {

            setError(
                'Email không hợp lệ'
            );

            return;
        }


        // ---------------------------------------------
        // LOADING
        // ---------------------------------------------

        setLoading(true);


        try {

            const data =
                await forgotPasswordApi(
                    normalizedEmail
                );


            console.log(
                'RESEND OTP:',
                data
            );


            // -----------------------------------------
            // SUCCESS
            // -----------------------------------------

            setSuccess(
                data.message ||
                'Mã OTP mới đã được gửi.'
            );


            // -----------------------------------------
            // RESET COOLDOWN
            // -----------------------------------------

            setResendCooldown(60);


            // -----------------------------------------
            // CLEAR OLD OTP
            // -----------------------------------------

            setOtp('');


        } catch (error) {

            console.error(
                'RESEND OTP ERROR:',
                error
            );


            setError(
                error.response?.data?.message ||
                'Không thể gửi lại mã OTP'
            );


        } finally {

            setLoading(false);
        }
    };


    // =====================================================
    // STEP 3
    // RESET PASSWORD
    // =====================================================

    const handleResetPassword = async (event) => {

        event.preventDefault();


        // ---------------------------------------------
        // CLEAR MESSAGE
        // ---------------------------------------------

        setError('');
        setSuccess('');


        // ---------------------------------------------
        // VALIDATE NEW PASSWORD
        // ---------------------------------------------

        if (!newPassword) {

            setError(
                'Vui lòng nhập mật khẩu mới'
            );

            return;
        }


        // ---------------------------------------------
        // PASSWORD LENGTH
        // ---------------------------------------------

        if (newPassword.length < 8) {

            setError(
                'Mật khẩu mới phải có ít nhất 8 ký tự'
            );

            return;
        }


        // ---------------------------------------------
        // CONFIRM PASSWORD
        // ---------------------------------------------

        if (!confirmPassword) {

            setError(
                'Vui lòng xác nhận mật khẩu'
            );

            return;
        }


        // ---------------------------------------------
        // PASSWORD MATCH
        // ---------------------------------------------

        if (newPassword !== confirmPassword) {

            setError(
                'Mật khẩu xác nhận không khớp'
            );

            return;
        }


        // ---------------------------------------------
        // RESET TOKEN
        // ---------------------------------------------

        if (!resetToken) {

            setError(
                'Phiên đặt lại mật khẩu không hợp lệ'
            );

            return;
        }


        // ---------------------------------------------
        // LOADING
        // ---------------------------------------------

        setLoading(true);


        try {

            const data =
                await resetPasswordApi(
                    resetToken,
                    newPassword
                );


            console.log(
                'RESET PASSWORD:',
                data
            );


            // -----------------------------------------
            // SUCCESS
            // -----------------------------------------

            setSuccess(
                data.message ||
                'Đặt lại mật khẩu thành công.'
            );


            // -----------------------------------------
            // CLEAR FORM
            // -----------------------------------------

            setOtp('');
            setNewPassword('');
            setConfirmPassword('');
            setResetToken('');
            setResendCooldown(0);


            // time return login

            const timer = setTimeout(() => {

                onLogin();

            }, 2000);


            // Cleanup timer nếu component unmount
            return () => {
                clearTimeout(timer);
            };


        } catch (error) {

            console.error(
                'RESET PASSWORD ERROR:',
                error
            );


            const message =
                error.response?.data?.message ||
                'Không thể đặt lại mật khẩu';


            setError(message);


        } finally {

            setLoading(false);
        }
    };


    // =====================================================
    // BACK TO EMAIL
    // =====================================================

    const handleBackToEmail = () => {

        setError('');
        setSuccess('');


        // ---------------------------------------------
        // CLEAR OTP
        // ---------------------------------------------

        setOtp('');


        // ---------------------------------------------
        // CLEAR RESET TOKEN
        // ---------------------------------------------

        setResetToken('');


        // ---------------------------------------------
        // RESET COOLDOWN
        // ---------------------------------------------

        setResendCooldown(0);


        // ---------------------------------------------
        // BACK TO EMAIL STEP
        // ---------------------------------------------

        setStep('email');
    };


    // =====================================================
    // RENDER
    // =====================================================

    return (

        <>

            {/* =================================================
                STEP 1
                ENTER EMAIL
            ================================================= */}

            {step === 'email' && (

                <form
                    className="auth-form"
                    onSubmit={handleSendOtp}
                >

                    {/* -----------------------------------------
                        EMAIL
                    ----------------------------------------- */}

                    <div className="auth-field">

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
                            disabled={loading}
                        />

                    </div>


                    {/* -----------------------------------------
                        DESCRIPTION
                    ----------------------------------------- */}

                    <p className="forgot-description">

                        Nhập email đã đăng ký để
                        lấy lại mật khẩu.

                    </p>


                    {/* -----------------------------------------
                        SEND OTP
                    ----------------------------------------- */}

                    <button
                        className="auth-submit"
                        type="submit"
                        disabled={loading}
                    >

                        {loading
                            ? 'Đang gửi mã...'
                            : 'Gửi yêu cầu'}

                    </button>


                    {/* -----------------------------------------
                        BACK LOGIN
                    ----------------------------------------- */}

                    <div className="auth-actions single">

                        <button
                            type="button"
                            onClick={onLogin}
                            disabled={loading}
                        >
                            ← Quay lại đăng nhập
                        </button>

                    </div>

                </form>

            )}


            {/* =================================================
                STEP 2
                VERIFY OTP
            ================================================= */}

            {step === 'otp' && (

                <form
                    className="auth-form"
                    onSubmit={handleVerifyOtp}
                >

                    {/* -----------------------------------------
                        OTP INPUT
                    ----------------------------------------- */}

                    <div className="auth-field">

                        <label>
                            Mã OTP
                        </label>


                        <input
                            type="text"
                            value={otp}
                            onChange={(event) => {

                                const value =
                                    event.target.value
                                        .replace(/\D/g, '')
                                        .slice(0, 6);

                                setOtp(value);

                            }}
                            placeholder="Nhập mã OTP"
                            maxLength={6}
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            disabled={loading}
                        />

                    </div>


                    {/* -----------------------------------------
                        EMAIL DISPLAY
                    ----------------------------------------- */}

                    <p className="forgot-description">

                        Mã OTP đã được gửi đến:

                        <br />

                        <strong>
                            {email}
                        </strong>

                    </p>


                    {/* -----------------------------------------
                        VERIFY OTP
                    ----------------------------------------- */}

                    <button
                        className="auth-submit"
                        type="submit"
                        disabled={
                            loading ||
                            otp.length !== 6
                        }
                    >

                        {loading
                            ? 'Đang xác nhận...'
                            : 'Xác nhận OTP'}

                    </button>


                    {/* -----------------------------------------
                        CHANGE EMAIL
                    ----------------------------------------- */}

                    <div className="auth-actions">

                        <button
                            type="button"
                            onClick={handleBackToEmail}
                            disabled={loading}
                        >
                            ← Đổi email
                        </button>

                    </div>


                    {/* -----------------------------------------
                        RESEND OTP
                    ----------------------------------------- */}

                    <div className="auth-actions single">

                        <button
                            type="button"
                            onClick={handleResendOtp}
                            disabled={
                                loading ||
                                resendCooldown > 0
                            }
                        >

                            {resendCooldown > 0

                                ? `Gửi lại mã OTP sau ${resendCooldown}s`

                                : 'Gửi lại mã OTP'}

                        </button>

                    </div>

                </form>

            )}


            {/* =================================================
                STEP 3
                RESET PASSWORD
            ================================================= */}

            {step === 'reset' && (

                <form
                    className="auth-form"
                    onSubmit={handleResetPassword}
                >

                    {/* -----------------------------------------
                        NEW PASSWORD
                    ----------------------------------------- */}

                    <div className="auth-field">

                        <label>
                            Mật khẩu mới
                        </label>


                        <input
                            type="password"
                            value={newPassword}
                            onChange={(event) =>
                                setNewPassword(
                                    event.target.value
                                )
                            }
                            placeholder="Nhập mật khẩu mới"
                            autoComplete="new-password"
                            disabled={loading}
                        />

                    </div>


                    {/* -----------------------------------------
                        CONFIRM PASSWORD
                    ----------------------------------------- */}

                    <div className="auth-field">

                        <label>
                            Xác nhận mật khẩu
                        </label>


                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(event) =>
                                setConfirmPassword(
                                    event.target.value
                                )
                            }
                            placeholder="Nhập lại mật khẩu"
                            autoComplete="new-password"
                            disabled={loading}
                        />

                    </div>


                    {/* -----------------------------------------
                        DESCRIPTION
                    ----------------------------------------- */}

                    <p className="forgot-description">

                        Nhập mật khẩu mới cho tài khoản
                        của bạn.

                    </p>


                    {/* -----------------------------------------
                        RESET PASSWORD
                    ----------------------------------------- */}

                    <button
                        className="auth-submit"
                        type="submit"
                        disabled={loading}
                    >

                        {loading
                            ? 'Đang cập nhật...'
                            : 'Đặt lại mật khẩu'}

                    </button>

                </form>

            )}

        </>

    );
}


export default ForgotPasswordForm;