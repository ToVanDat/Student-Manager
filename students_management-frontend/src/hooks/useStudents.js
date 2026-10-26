import { useCallback, useEffect, useRef, useState } from 'react';
import { getStudents } from '@/api/studentApi.js';

const emptyStatistics = { totalStudents: 0, totalClasses: 0, male: 0, female: 0 };

export function useStudents(search, enabled = true, page = 1, pageSize = 10, sortBy = 'id', sortOrder = 'asc', classId = '', gender = '') {
    const [students, setStudents] = useState([]);
    const [recentStudents, setRecentStudents] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [statistics, setStatistics] = useState(emptyStatistics);
    const [classStatistics, setClassStatistics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const requestSequenceRef = useRef(0);
    const enabledRef = useRef(enabled);
    enabledRef.current = enabled;

    const loadStudents = useCallback(async () => {
        if (!enabledRef.current) return;

        const requestSequence = ++requestSequenceRef.current;
        setLoading(true);
        setError('');

        try {
            const query = { page, pageSize, search, sortBy, sortOrder };
            if (classId) query.classId = classId;
            if (gender) query.gender = gender;
            const result = await getStudents(query);
            if (requestSequence !== requestSequenceRef.current || !enabledRef.current) return;

            if (!result || !Array.isArray(result.data) || !result.pagination) {
                throw new Error('Phản hồi danh sách sinh viên từ máy chủ không hợp lệ.');
            }

            setStudents(result.data);
            setTotalCount(Number(result.pagination.totalCount) || 0);
            setStatistics({
                totalStudents: Number(result.statistics?.totalStudents) || 0,
                totalClasses: Number(result.statistics?.totalClasses) || 0,
                male: Number(result.statistics?.male) || 0,
                female: Number(result.statistics?.female) || 0
            });
            setClassStatistics(Array.isArray(result.classStatistics) ? result.classStatistics : []);
            setRecentStudents(Array.isArray(result.recentStudents) ? result.recentStudents : []);
        } catch (requestError) {
            if (requestSequence !== requestSequenceRef.current || !enabledRef.current) return;
            console.error('[STUDENTS] Could not load paginated roster:', requestError);
            setError(
                requestError.response?.data?.message ||
                requestError.message ||
                'Không thể kết nối đến Backend.'
            );
        } finally {
            if (requestSequence === requestSequenceRef.current && enabledRef.current) {
                setLoading(false);
            }
        }
    }, [enabled, page, pageSize, search, sortBy, sortOrder, classId, gender]);

    useEffect(() => {
        if (!enabled) {
            ++requestSequenceRef.current;
            setStudents([]);
            setRecentStudents([]);
            setTotalCount(0);
            setStatistics(emptyStatistics);
            setClassStatistics([]);
            setError('');
            setLoading(false);
            return undefined;
        }

        void loadStudents();
        return undefined;
    }, [enabled, loadStudents]);

    return {
        students,
        recentStudents,
        totalCount,
        loading,
        error,
        setError,
        loadStudents,
        // The API already applies search, sort and pagination; do not filter this
        // page again in the browser or the result count will be incorrect.
        filteredStudents: students,
        statistics,
        classStatistics
    };
}
