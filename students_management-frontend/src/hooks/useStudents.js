import { useCallback, useEffect, useMemo, useState } from 'react';
import { getStudents } from '@/api/studentApi.js';

export function useStudents(search) {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadStudents = useCallback(async () => {
        try {
            setLoading(true);
            setError('');

            const data = await getStudents();
            setStudents(Array.isArray(data) ? data : []);
        } catch (requestError) {
            console.error(requestError);
            setError(
                requestError.response?.data?.message ||
                    'Không thể kết nối đến Backend.',
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadStudents();
    }, [loadStudents]);

    const filteredStudents = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        if (!keyword) {
            return students;
        }

        return students.filter((student) =>
            [
                student.student_code,
                student.name,
                student.email,
                student.class_code,
                student.class_name,
            ].some((value) => String(value || '').toLowerCase().includes(keyword)),
        );
    }, [students, search]);

    const statistics = useMemo(() => {
        const classes = new Set(
            students.map((student) => student.class_code).filter(Boolean),
        );

        return {
            totalStudents: students.length,
            totalClasses: classes.size,
            male: students.filter(
                (student) => String(student.gender).toLowerCase() === 'male',
            ).length,
            female: students.filter(
                (student) => String(student.gender).toLowerCase() === 'female',
            ).length,
        };
    }, [students]);

    const classStatistics = useMemo(() => {
        const byClass = new Map();

        students.forEach((student) => {
            const code = student.class_code || 'Chưa phân lớp';
            const current = byClass.get(code) || {
                code,
                name: student.class_name || '',
                count: 0,
            };

            current.count += 1;
            byClass.set(code, current);
        });

        return [...byClass.values()].sort((left, right) => right.count - left.count);
    }, [students]);

    return {
        students,
        loading,
        error,
        setError,
        loadStudents,
        filteredStudents,
        statistics,
        classStatistics,
    };
}