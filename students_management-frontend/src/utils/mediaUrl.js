import { API_BASE_URL } from './constants.js';

export const resolveMediaUrl = value => {
    if (typeof value !== 'string' || !value) return value;
    if (value.startsWith('/media/avatars/')) {
        return `${String(API_BASE_URL || '').replace(/\/$/, '')}${value}`;
    }
    return value;
};
