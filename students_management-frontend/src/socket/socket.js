import { io } from 'socket.io-client';
import { API_BASE_URL } from '@/utils/constants.js';

const socket = io(API_BASE_URL, {
    autoConnect: false,
    auth: {
        accessToken: null
    }
});

export default socket;