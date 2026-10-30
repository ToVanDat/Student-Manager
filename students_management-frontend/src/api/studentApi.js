import { apiClient } from '@/api/client.js';

const STUDENT_API_URL = '/api/students';

export const getStudentAccountLinks = async (search = '') => {
  const response = await apiClient.get(`${STUDENT_API_URL}/account-links`, { params: { search } });
  return response.data?.data;
};

export const createStudentAccountLink = async (payload) => {
  const response = await apiClient.post(`${STUDENT_API_URL}/account-links`, payload);
  return response.data;
};

export const deleteStudentAccountLink = async (userId, reason) => {
  const response = await apiClient.delete(`${STUDENT_API_URL}/account-links/${encodeURIComponent(userId)}`, { data: { reason } });
  return response.data;
};

export const getMyAcademicProfile = async () => {
  const response = await apiClient.get('/api/academic/me');
  return response.data;
};

export const getMyAcademicGrades = async (semesterId) => {
  const response = await apiClient.get('/api/academic/me/grades', {
    params: semesterId ? { semesterId } : undefined,
  });
  return response.data;
};

export const getAcademicStudentByCode = async (studentCode, semesterId) => {
  const response = await apiClient.get('/api/academic/students/' + encodeURIComponent(studentCode), {
    params: semesterId ? { semesterId } : undefined,
  });
  return response.data;
};

export const getMyStudentPortal = async () => {
  const response = await apiClient.get(`${STUDENT_API_URL}/me`);
  return response.data;
};

export const exportStudentsCsv = async (params = {}) => {
  const response = await apiClient.get(`${STUDENT_API_URL}/export`, {
    params,
    responseType: 'blob',
  });
  return response.data;
};

export const previewStudentCsvImport = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post(`${STUDENT_API_URL}/import/preview`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const confirmStudentCsvImport = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post(`${STUDENT_API_URL}/import`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const getStudents = async (params) => {
  const response = params
    ? await apiClient.get(STUDENT_API_URL, { params })
    : await apiClient.get(STUDENT_API_URL);
  return response.data;
};

export const createStudent = async (studentData) => {
  const response = await apiClient.post(STUDENT_API_URL, studentData);
  return response.data;
};

export const updateStudent = async (id, studentData) => {
  const response = await apiClient.patch(
    `${STUDENT_API_URL}/${id}`,
    studentData,
  );
  return response.data;
};

export const deleteStudent = async (id) => {
  const response = await apiClient.delete(`${STUDENT_API_URL}/${id}`);
  return response.data;
};

export const getStudentById = async (id) => {
  const response = await apiClient.get(`${STUDENT_API_URL}/${id}`);
  return response.data;
};
