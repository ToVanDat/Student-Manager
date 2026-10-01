import { useContext } from 'react';
import AuthContext from './AuthContext.jsx';

export const useAuth = () => {
    return useContext(AuthContext);
};