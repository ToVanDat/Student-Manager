import axios from 'axios';
import { API_BASE_URL } from '../constant';

const STUDENT_API_URL = `${API_BASE_URL}/api/students`;

export const getStudents = async () => {
  const response = await apiClient.get(STUDENT_API_URL);
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
