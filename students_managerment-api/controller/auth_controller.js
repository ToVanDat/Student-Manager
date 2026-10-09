const authService =
    require('../service/authService.js');

const { getDeviceInfo } =
    require('../src/utils/device.js');


// ======================================================
// GET ME
// GET /api/auth/me
// ======================================================

const getMe = async (req, res) => {

    try {

        const user =
            await authService.getMe(
                req.user.sub
            );


        if (!user) {

            return res.status(404).json({
                message:
                    'Không tìm thấy user'
            });

        }


        return res.status(200).json({

            user

        });

    } catch (error) {

        console.error(
            'LỖI ME:',
            error
        );


        return res.status(500).json({

            message:
                'Lỗi server'

        });

    }

};



// ======================================================
// UPDATE PROFILE
// PATCH /api/auth/me
// ======================================================

const updateProfile = async (req, res) => {
    try {

        // ==============================================
        // USER ID
        // ==============================================

        const userId =
            req.user.sub;


        // ==============================================
        // REQUEST BODY
        // ==============================================

        const {
            username,
            email
        } = req.body;


        // ==============================================
        // VALIDATE INPUT
        // ==============================================

        if (
            !username ||
            !email
        ) {

            return res.status(400).json({

                message:
                    'Username và email là bắt buộc'

            });

        }


        // ==============================================
        // CALL SERVICE
        // ==============================================

        const user =
            await authService.updateProfile(
                userId,
                username,
                email
            );


        // ==============================================
        // RESPONSE
        // ==============================================

        return res.status(200).json({

            message:
                'Cập nhật thông tin tài khoản thành công',

            user

        });

    } catch (error) {

        console.error(
            'LỖI UPDATE PROFILE:',
            error
        );


        return res.status(400).json({

            message:
                error.message ||
                'Cập nhật thông tin tài khoản thất bại'

        });

    }

};



// ======================================================
// CHANGE PASSWORD
// POST /api/auth/change-password
// ======================================================

const changePassword = async (req, res) => {

    try {

        // ==============================================
        // USER ID
        // ==============================================

        const userId =
            req.user.sub;


        // ==============================================
        // REQUEST BODY
        // ==============================================

        const {
            currentPassword,
            newPassword
        } = req.body;


        // ==============================================
        // VALIDATE INPUT
        // ==============================================

        if (
            !currentPassword ||
            !newPassword
        ) {

            return res.status(400).json({

                message:
                    'Mật khẩu hiện tại và mật khẩu mới là bắt buộc'

            });

        }


        // ==============================================
        // CALL SERVICE
        // ==============================================

        await authService.changePassword(
            userId,
            currentPassword,
            newPassword
        );


        // ==============================================
        // RESPONSE
        // ==============================================

        return res.status(200).json({

            message:
                'Đổi mật khẩu thành công'

        });

    } catch (error) {

        console.error(
            'LỖI CHANGE PASSWORD:',
            error
        );


        return res.status(400).json({

            message:
                error.message ||
                'Đổi mật khẩu thất bại'

        });

    }

};
// API forgot password
const forgotPassword = async (
    req,
    res
) => {

    try {

        const {
            email
        } = req.body;

        if (!email) {
            return res.status(400).json({
                message: 'Email là bắt buộc'
            });
        }

        await authService
            .forgotPassword(email);

        /*
         * Luôn trả cùng một message,
         * dù email tồn tại hay không.
         *
         * Tránh email enumeration.
         */
        return res.status(200).json({
            message:
                'mã OTP đã được gửi.'
        });

    } catch (error) {

        console.error(
            'FORGOT PASSWORD ERROR:',
            error
        );

        return res.status(500).json({
            message:
                'Không gửi được email OTP. Hãy kiểm tra cấu hình người gửi đã được xác minh trên dịch vụ email.'
        });
    }
};
// API test email
////
const emailService = require('../service/emailService.js');

// API test email
const testEmail = async (req, res) => {
    try {

        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                message: 'Email là bắt buộc'
            });
        }

        await emailService.sendEmail({
            to: email,
            subject: 'Student Management ',
            html: `
                <h2>Student Management</h2>

                <p>
                    Đây là email từ hệ thống
                    Student Management.
                </p>

                <p>
                    Resend đã được cấu hình thành công.
                </p>
            `
        });

        return res.json({
            message: 'Email đã được gửi'
        });

    } catch (error) {

        console.error(
            'TEST EMAIL ERROR:',
            error
        );

        return res.status(500).json({
            message: 'Gửi email thất bại'
        });
    }
};
// api verify reset otp
const verifyResetOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                message: 'Email và OTP là bắt buộc'
            });
        }

        const result = await authService.verifyResetOtp(email, otp);

        return res.status(200).json(result);

    } catch (error) {
        console.error('VERIFY RESET OTP ERROR:', error);

        return res.status(400).json({
            message: error.message || 'Xác thực OTP thất bại'
        });
    }
};

// api reset password
const resetPassword = async (req, res) => {

    try {

        const {
            resetToken,
            newPassword
        } = req.body;


        if (!resetToken) {

            return res.status(400).json({
                message: 'Reset token là bắt buộc'
            });
        }


        if (!newPassword) {

            return res.status(400).json({
                message: 'Mật khẩu mới là bắt buộc'
            });
        }


        const result =
            await authService.resetPassword(
                resetToken,
                newPassword
            );


        return res.status(200).json(result);

    } catch (error) {

        console.error(
            'RESET PASSWORD ERROR:',
            error
        );


        return res.status(400).json({
            message:
                error.message ||
                'Không thể đặt lại mật khẩu'
        });
    }
};
// ======================================================
// REGISTER
// POST /api/auth/register
// ======================================================

const register = async (req, res) => {

    try {

        const {
            username,
            email,
            password
        } = req.body;


        // ==============================================
        // VALIDATE INPUT
        // ==============================================

        if (
            !username ||
            !email ||
            !password
        ) {

            return res.status(400).json({

                message:
                    'Vui lòng nhập đầy đủ username, email và password'

            });

        }


        // ==============================================
        // CALL SERVICE
        // ==============================================

        const user =
            await authService.register(
                username,
                email,
                password
            );


        // ==============================================
        // RESPONSE
        // ==============================================

        return res.status(201).json({

            message:
                'Đăng ký thành công',

            user

        });

    } catch (error) {

        console.error(
            'LỖI REGISTER:',
            error
        );


        return res.status(400).json({

            message:
                error.message ||
                'Đăng ký thất bại'

        });

    }

};



// ======================================================
// LOGIN
// POST /api/auth/login
// ======================================================

const login = async (req, res) => {

    try {

        const {
            username,
            password
        } = req.body;


        // ==============================================
        // VALIDATE INPUT
        // ==============================================

        if (
            !username ||
            !password
        ) {

            return res.status(400).json({

                message:
                    'Username và password là bắt buộc'

            });

        }


        // ==============================================
        // DEVICE INFORMATION
        // ==============================================

        const userAgent =
            req.headers['user-agent'] || '';


        const ipAddress =
            req.ip || null;


        const deviceInfo =
            getDeviceInfo(
                userAgent
            );


        // ==============================================
        // LOGIN SERVICE
        // ==============================================

        const result =
            await authService.login(
                username,
                password,
                deviceInfo.deviceName,
                userAgent,
                ipAddress
            );


        // ==============================================
        // SET REFRESH TOKEN COOKIE
        // ==============================================

        res.cookie(
            'refreshToken',
            result.refreshToken,
            {

                httpOnly: true,

                secure: process.env.NODE_ENV === 'production',

                sameSite: 'lax',

                maxAge:
                    7 *
                    24 *
                    60 *
                    60 *
                    1000,

                path: '/api/auth'

            }
        );


        // ==============================================
        // RESPONSE
        // ==============================================

        return res.status(200).json({

            message:
                'Đăng nhập thành công',

            user:
                result.user,

            accessToken:
                result.accessToken

        });

    } catch (error) {

        console.error(
            'LOGIN ERROR:',
            error
        );


        return res.status(401).json({

            message:
                error.message ||
                'Đăng nhập thất bại'

        });

    }

};



// ======================================================
// REFRESH
// POST /api/auth/refresh
// ======================================================

const refresh = async (req, res) => {

    try {

        /*
            Refresh Token được lấy
            từ HttpOnly Cookie.

            Không lấy từ req.body.
        */

        const refreshToken =
            req.cookies.refreshToken;


        // ==============================================
        // CHECK REFRESH TOKEN
        // ==============================================

        if (!refreshToken) {

            return res.status(401).json({

                message:
                    'Refresh Token không tồn tại'

            });

        }


        // ==============================================
        // REFRESH SERVICE
        // ==============================================

        const result =
            await authService.refresh(
                refreshToken
            );


        // ==============================================
        // ROTATE REFRESH TOKEN
        // ==============================================

        /*
            RT cũ:

                RT1
                 ↓
              revoked

            RT mới:

                RT2
                 ↓
              active
        */

        res.cookie(
            'refreshToken',
            result.refreshToken,
            {

                httpOnly: true,

                secure: process.env.NODE_ENV === 'production',

                sameSite: 'lax',

                maxAge:
                    7 *
                    24 *
                    60 *
                    60 *
                    1000,

                path: '/api/auth'

            }
        );


        // ==============================================
        // CHỈ TRẢ ACCESS TOKEN
        // ==============================================

        return res.status(200).json({

            accessToken:
                result.accessToken

        });

    } catch (error) {

        console.error(
            'LỖI REFRESH:',
            error
        );


        /*
            Refresh Token không hợp lệ,
            hết hạn,
            đã revoke,
            hoặc session đã revoke.
        */

        return res.status(401).json({

            message:
                error.message ||
                'Refresh Token không hợp lệ'

        });

    }

};



// ======================================================
// LOGOUT
// POST /api/auth/logout
// ======================================================

const logout = async (req, res) => {

    try {

        // ==============================================
        // LẤY ACCESS TOKEN
        // ==============================================

        const authHeader =
            req.headers.authorization;


        let accessToken = null;


        if (
            authHeader &&
            authHeader.startsWith('Bearer ')
        ) {

            accessToken =
                authHeader.substring(7);

        }


        // ==============================================
        // LẤY REFRESH TOKEN
        // ==============================================

        const refreshToken =
            req.cookies.refreshToken;


        // ==============================================
        // CALL AUTH SERVICE
        // ==============================================

        await authService.logout(
            accessToken,
            refreshToken
        );


        // ==============================================
        // CLEAR COOKIE
        // ==============================================

        res.clearCookie(
            'refreshToken',
            {

                httpOnly: true,

                secure: process.env.NODE_ENV === 'production',

                sameSite: 'lax',

                path: '/api/auth'

            }
        );


        // ==============================================
        // RESPONSE
        // ==============================================

        return res.status(200).json({

            message:
                'Đăng xuất thành công'

        });

    } catch (error) {

        console.error(
            'LỖI LOGOUT:',
            error
        );


        /*
            Dù logout có lỗi ở backend,
            browser vẫn nên xóa cookie.
        */

        res.clearCookie(
            'refreshToken',
            {

                httpOnly: true,

                secure: process.env.NODE_ENV === 'production',

                sameSite: 'lax',

                path: '/api/auth'

            }
        );


        return res.status(500).json({

            message:
                error.message ||
                'Đăng xuất thất bại'

        });

    }

};



// ======================================================
// EXPORT
// ======================================================

module.exports = {

    register,

    login,

    getMe,

    updateProfile,

    changePassword,

    refresh,

    logout,

    testEmail,

    forgotPassword,

    verifyResetOtp,

    resetPassword

};