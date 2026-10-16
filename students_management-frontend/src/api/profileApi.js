import client from './client';

export const uploadAvatarApi = async file => {
    const formData = new FormData();
    formData.append('avatar', file);
    const response = await client.post('/api/auth/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
};
