import axios from 'axios';

const API_URL = 'http://localhost:3000/api/students';

const getAuthHeaders = () => {
    const accessToken =
        localStorage.getItem('accessToken');

    return {
        Authorization: `Bearer ${accessToken}`
    };
};

export const getStudents = async () => {
    const response = await axios.get(
        API_URL,
        {
            headers: getAuthHeaders()
        }
    );

    return response.data;
};

export const createStudent = async (studentData) => {
    const response = await axios.post(
        API_URL,
        studentData,
        {
            headers: getAuthHeaders()
        }
    );

    return response.data;
};

export const updateStudent = async (id, studentData) => {
    const response = await axios.patch(
        `${API_URL}/${id}`,
        studentData,
        {
            headers: getAuthHeaders()
        }
    );

    return response.data;
};

export const deleteStudent = async (id) => {
    const response = await axios.delete(
        `${API_URL}/${id}`,
        {
            headers: getAuthHeaders()
        }
    );

    return response.data;
};

export const getStudentById = async (id) => {
    const response = await axios.get(
        `${API_URL}/${id}`,
        {
            headers: getAuthHeaders()
        }
    );

    return response.data;
};
