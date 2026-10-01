import axios from 'axios';

const API_URL =
    'http://localhost:3000/api/auth/sessions';


const getAuthConfig = () => {

    const accessToken =
        localStorage.getItem('accessToken');

    return {
        withCredentials: true,

        headers: {
            Authorization:
                `Bearer ${accessToken}`
        }
    };
};


// ======================================================
// GET SESSIONS
// ======================================================

export const getSessionsApi = async () => {

    const response =
        await axios.get(
            API_URL,
            getAuthConfig()
        );

    return response.data;
};


// ======================================================
// REVOKE 1 SESSION
// ======================================================

export const revokeSessionApi =
    async (sessionId) => {

        const response =
            await axios.delete(
                `${API_URL}/${sessionId}`,
                getAuthConfig()
            );

        return response.data;
    };


// ======================================================
// REVOKE OTHER SESSIONS
// ======================================================

export const revokeOtherSessionsApi =
    async () => {

        const response =
            await axios.post(
                `${API_URL}/revoke-others`,
                {},
                getAuthConfig()
            );

        return response.data;
    };