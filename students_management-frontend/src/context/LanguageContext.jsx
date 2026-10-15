import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AuthContext from './AuthContext.jsx';
import { getUserPreferences, updateUserPreferences } from '@/api/preferencesApi.js';

const LanguageContext = createContext(null);
const STORAGE_KEY = 'student-management-language';

const messages = {
  vi: {
    language: 'Ngôn ngữ', vietnamese: 'Tiếng Việt', english: 'English',
    languageDescription: 'Chọn ngôn ngữ hiển thị cho giao diện ứng dụng.',
    languageSaved: 'Lựa chọn được lưu vào tài khoản và đồng bộ trên các thiết bị.',
    quickLanguage: 'Đổi ngôn ngữ', themeLight: 'Giao diện sáng', themeDark: 'Giao diện tối',
    searchStudents: 'Tìm kiếm sinh viên, lớp học, mã sinh viên, email...',
    notifications: 'Thông báo', markAllRead: 'Đọc tất cả', openNotifications: 'Mở thông báo',
    loadingNotifications: 'Đang tải thông báo...', noNotifications: 'Chưa có thông báo nào.',
    unread: 'chưa đọc', account: 'Thông tin tài khoản', security: 'Bảo mật',
    sessions: 'Phiên đăng nhập', password: 'Đổi mật khẩu', appearance: 'Giao diện',
    logout: 'Đăng xuất', administrator: 'Quản trị viên', user: 'Người dùng',
    settingsTitle: 'Cài đặt tài khoản', settingsDescription: 'Quản lý thông tin tài khoản, bảo mật và các phiên đăng nhập.',
    dashboard: 'Bảng điều khiển quản trị', welcome: 'Chào mừng',
    overview: 'Tổng quan hệ thống quản lý sinh viên',
    totalStudents: 'Tổng số sinh viên', totalClasses: 'Tổng số lớp', male: 'Nam', female: 'Nữ', current: 'Hiện tại',
    studentsInSystem: 'Sinh viên trong hệ thống', classesWithStudents: 'Lớp đang có sinh viên', studentProfile: 'Theo hồ sơ sinh viên',
    classDistribution: 'Phân bố sinh viên theo lớp', classCounts: 'Sĩ số theo dữ liệu hiện có', recentStudents: 'Sinh viên gần đây', newestProfiles: 'Hồ sơ mới nhất trong danh sách',
    viewAll: 'Xem tất cả', students: 'Sinh viên', classes: 'Quản lý lớp học', departments: 'Quản lý khoa - ngành', subjects: 'Quản lý môn học',
    enrollments: 'Đăng ký học', semesters: 'Học kỳ', results: 'Kết quả học tập', home: 'Trang chủ', overviewGroup: 'TỔNG QUAN', trainingGroup: 'QUẢN LÝ ĐÀO TẠO',
    systemGroup: 'QUẢN TRỊ HỆ THỐNG', studentsCount: 'sinh viên', noClassData: 'Chưa có dữ liệu lớp', addClassHint: 'Thêm hồ sơ sinh viên có lớp để xem thống kê.',
    noStudentProfiles: 'Chưa có hồ sơ sinh viên', createFirstProfile: 'Tạo hồ sơ đầu tiên để bắt đầu quản lý.', manageStudents: 'Quản lý sinh viên',
  },
  en: {
    language: 'Language', vietnamese: 'Vietnamese', english: 'English',
    languageDescription: 'Choose the language used throughout the application.',
    languageSaved: 'Your choice is saved to your account and synced across devices.',
    quickLanguage: 'Change language', themeLight: 'Light theme', themeDark: 'Dark theme',
    searchStudents: 'Search students, classes, student ID, email...',
    notifications: 'Notifications', markAllRead: 'Mark all read', openNotifications: 'Open notifications',
    loadingNotifications: 'Loading notifications...', noNotifications: 'No notifications yet.',
    unread: 'unread', account: 'Account information', security: 'Security',
    sessions: 'Active sessions', password: 'Change password', appearance: 'Appearance',
    logout: 'Log out', administrator: 'Administrator', user: 'User',
    settingsTitle: 'Account settings', settingsDescription: 'Manage account information, security, and active sessions.',
    dashboard: 'Admin dashboard', welcome: 'Welcome',
    overview: 'Student management overview',
    totalStudents: 'Total students', totalClasses: 'Total classes', male: 'Male', female: 'Female', current: 'Current',
    studentsInSystem: 'Students in the system', classesWithStudents: 'Classes with students', studentProfile: 'Based on student profiles',
    classDistribution: 'Students by class', classCounts: 'Enrollment based on current data', recentStudents: 'Recent students', newestProfiles: 'Latest profiles in the list',
    viewAll: 'View all', students: 'Students', classes: 'Manage classes', departments: 'Manage departments', subjects: 'Manage subjects',
    enrollments: 'Enrollments', semesters: 'Semesters', results: 'Academic results', home: 'Home', overviewGroup: 'OVERVIEW', trainingGroup: 'ACADEMIC MANAGEMENT',
    systemGroup: 'SYSTEM ADMINISTRATION', studentsCount: 'students', noClassData: 'No class data yet', addClassHint: 'Add students with class assignments to see statistics.',
    noStudentProfiles: 'No student profiles yet', createFirstProfile: 'Create the first profile to get started.', manageStudents: 'Manage students',
  },
};

function readLanguage() {
  try { return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'vi'; }
  catch { return 'vi'; }
}

export function LanguageProvider({ children }) {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const isAuthenticated = Boolean(auth?.isAuthenticated && user?.id);
  const [language, setLanguageState] = useState(readLanguage);

  // PostgreSQL is the source of truth for signed-in users; localStorage is a fast cache.
  useEffect(() => {
    let active = true;
    if (!isAuthenticated) return () => { active = false; };

    getUserPreferences()
      .then((preferences) => {
        if (!active || !['vi', 'en'].includes(preferences?.preferredLanguage)) return;
        setLanguageState(preferences.preferredLanguage);
        try { localStorage.setItem(STORAGE_KEY, preferences.preferredLanguage); } catch { /* Storage may be unavailable. */ }
      })
      .catch((error) => {
        console.warn('[PREFERENCES] Không thể tải ngôn ngữ từ tài khoản; dùng cache cục bộ.', error.message);
      });

    return () => { active = false; };
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    document.documentElement.lang = language;
    try { localStorage.setItem(STORAGE_KEY, language); } catch { /* Storage may be unavailable. */ }
  }, [language]);

  const setLanguage = (nextLanguage) => {
    if (!['vi', 'en'].includes(nextLanguage)) return;
    setLanguageState(nextLanguage);
    try { localStorage.setItem(STORAGE_KEY, nextLanguage); } catch { /* Storage may be unavailable. */ }

    if (isAuthenticated) {
      updateUserPreferences({ preferredLanguage: nextLanguage }).catch((error) => {
        console.error('[PREFERENCES] Không thể lưu ngôn ngữ vào tài khoản:', error.response?.data?.message || error.message);
      });
    }
  };

  const value = useMemo(() => ({
    language,
    setLanguage,
    t: (key) => messages[language]?.[key] ?? messages.vi[key] ?? key,
  }), [language, isAuthenticated, user?.id]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage phải được sử dụng bên trong LanguageProvider');
  return context;
}
