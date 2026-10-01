import axios from 'axios';

const API_URL =
    'http://localhost:3000/api/auth';

//login
export const loginApi = async (
    username,
    password
) => {

    const response =
        await axios.post(
            `${API_URL}/login`,
            {
                username,
                password,
             
            },
            {
                withCredentials: true
            }
        );

    return response.data;
};

//register

export const registerApi = async (
    username,
    email,
    password
) => {

    const response =
        await axios.post(
            `${API_URL}/register`,
            {
                username,
                email,
                password
            }
        );

    return response.data;
};

//refresh
export const refreshApi = async () => {

    const response =
        await axios.post(
            `${API_URL}/refresh`,
            {},
            {
                withCredentials: true
            }
        );

    return response.data;
};

//logout

export const logoutApi = async () => {

    const accessToken =
        localStorage.getItem(
            'accessToken'
        );


    const response =
        await axios.post(
            `${API_URL}/logout`,
            {},
            {
                withCredentials: true,

                headers: {
                    Authorization:
                        `Bearer ${accessToken}`
                }
            }
        );


    return response.data;
};



// =====================================================
// FORGOT PASSWORD
// =====================================================

export const forgotPasswordApi = async (email) => {

    const response = await axios.post(
        `${API_URL}/forgot-password`,
        {
            email
        }
    );

    return response.data;
};

// =====================================================
// VERIFY OTP
// =====================================================

export const verifyResetOtpApi = async (
    email,
    otp
) => {

    const response = await axios.post(
        `${API_URL}/verify-reset-otp`,
        {
            email,
            otp
        }
    );

    return response.data;
};


// =====================================================
// RESET PASSWORD
// =====================================================

export const resetPasswordApi = async (
    resetToken,
    newPassword
) => {

    const response = await axios.post(
        `${API_URL}/reset-password`,
        {
            resetToken,
            newPassword
        }
    );

    return response.data;
};