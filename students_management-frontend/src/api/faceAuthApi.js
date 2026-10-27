import axios from 'axios';
import { API_BASE_URL } from '@/utils/constants.js';

const config = () => ({
  withCredentials: true,
  headers: {
    Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}`,
  },
});

export const createFaceEnrollmentChallengeApi = async () => {
  const response = await axios.post(
    `${API_BASE_URL}/api/auth/face/enrollment/challenge`,
    {},
    config(),
  );
  return response.data;
};

export const completeFaceEnrollmentApi = async (challengeId, embedding) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/auth/face/enrollment/complete`,
    { challengeId, embedding },
    config(),
  );
  return response.data;
};

export const getFaceCredentialApi = async () => {
  const response = await axios.get(
    `${API_BASE_URL}/api/auth/face/credential`,
    config(),
  );
  return response.data.credential || null;
};

export const revokeFaceCredentialApi = async () => {
  const response = await axios.delete(
    `${API_BASE_URL}/api/auth/face/credential`,
    config(),
  );
  return response.data;
};
