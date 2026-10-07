import client from './client';

export const userApi = {
    searchForChat: (search = '') =>
        client.get('/api/users/chat-search', {
            params: { search }
        })
};
