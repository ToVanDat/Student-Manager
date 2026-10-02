import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from 'sonner';
import {
  Search,
  Bell,
  Moon,
  Sun,
  MoreVertical,
  User,
  Settings,
  LogOut,
  Home,
  Users,
  GraduationCap,
  BookOpen,
  Layers,
  ClipboardList,
  CalendarDays,
  BarChart3,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Filter,
  ArrowUpDown,
  X,
  Menu,
  Sparkles,
  ShieldCheck,
  Monitor,
  Smartphone,
  KeyRound,
  Mail,
  Save,
  RefreshCw,
  Globe,
  Clock3,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import { useAuth } from "../auth/useAuth.js";

import StudentTable from "../components/studentTable.jsx";
import StudentForm from "../components/studentForm.jsx";

import {
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
} from "../service/studentApi.js";

import "./students.css";
import axios from "axios";
import {
  getSessionsApi,
  revokeSessionApi,
  revokeOtherSessionsApi,
} from "../service/sessionApi.js";

/*
 * Settings styles are kept here temporarily because the current requirement
 * is to keep the entire dashboard/settings UI inside students.jsx.
 */
const settingsStyles = `
.settings-page {
    width: 100%;
    animation: settingsFadeIn .2s ease;
}

@keyframes settingsFadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
}

.settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 24px;
}

.settings-kicker {
    display: block;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .12em;
    margin-bottom: 6px;
    opacity: .65;
}

.settings-header h1 {
    margin: 0 0 6px;
    font-size: 28px;
}

.settings-header p {
    margin: 0;
    opacity: .68;
}

.settings-layout {
    display: grid;
    grid-template-columns: 230px minmax(0, 1fr);
    gap: 20px;
    align-items: start;
}

.settings-menu,
.settings-card {
    background: var(--card-bg, #fff);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 16px;
    box-shadow: 0 8px 30px rgba(15, 23, 42, .06);
}

.settings-menu {
    padding: 8px;
    position: sticky;
    top: 20px;
}

.settings-menu-item {
    width: 100%;
    border: 0;
    background: transparent;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 12px 13px;
    border-radius: 11px;
    cursor: pointer;
    text-align: left;
    font-size: 14px;
    color: inherit;
}

.settings-menu-item:hover {
    background: rgba(99, 102, 241, .08);
}

.settings-menu-item.active {
    background: rgba(99, 102, 241, .12);
    font-weight: 700;
}

.settings-count {
    margin-left: auto;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 800;
    background: rgba(99, 102, 241, .12);
}

.settings-content {
    min-width: 0;
}

.settings-card {
    padding: 24px;
}

.settings-card-header {
    display: flex;
    align-items: flex-start;
    gap: 13px;
    margin-bottom: 24px;
}

.settings-card-icon {
    width: 40px;
    height: 40px;
    flex: 0 0 40px;
    border-radius: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(99, 102, 241, .11);
}

.settings-card-header h2 {
    margin: 0 0 5px;
    font-size: 20px;
}

.settings-card-header p {
    margin: 0;
    opacity: .66;
    font-size: 13px;
}

.settings-card-title-row {
    display: flex;
    gap: 13px;
}

.session-main-header {
    justify-content: space-between;
}

.settings-form {
    display: grid;
    gap: 18px;
    max-width: 720px;
}

.settings-field {
    display: grid;
    gap: 8px;
}

.settings-field label {
    font-size: 13px;
    font-weight: 700;
}

.settings-input-wrap {
    min-height: 46px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 13px;
    border: 1px solid var(--border-color, #dfe3ea);
    border-radius: 10px;
    background: var(--input-bg, #fff);
}

.settings-input-wrap:focus-within {
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, .10);
}

.settings-input-wrap input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: inherit;
    font: inherit;
}

.settings-user-meta {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
}

.settings-user-meta > div,
.session-summary-item {
    padding: 14px;
    border-radius: 12px;
    background: rgba(100, 116, 139, .06);
}

.settings-user-meta span,
.session-summary-item span,
.session-meta-grid span {
    display: block;
    font-size: 12px;
    opacity: .62;
    margin-bottom: 4px;
}

.settings-user-meta strong,
.session-summary-item strong {
    font-size: 14px;
    word-break: break-word;
}

.settings-actions {
    display: flex;
    justify-content: flex-end;
}

.settings-message,
.settings-error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    border-radius: 10px;
    font-size: 13px;
}

.settings-message {
    background: rgba(34, 197, 94, .10);
}

.settings-error {
    background: rgba(239, 68, 68, .10);
}

.secondary-button,
.danger-outline-button,
.session-revoke-button,
.settings-refresh-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border-radius: 9px;
    padding: 9px 13px;
    border: 1px solid var(--border-color, #dfe3ea);
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-weight: 600;
}

.danger-outline-button,
.session-revoke-button {
    border-color: rgba(239, 68, 68, .35);
}

.danger-outline-button:hover,
.session-revoke-button:hover {
    background: rgba(239, 68, 68, .08);
}

.secondary-button:hover,
.settings-refresh-button:hover {
    background: rgba(100, 116, 139, .08);
}

.secondary-button:disabled,
.danger-outline-button:disabled,
.session-revoke-button:disabled,
.settings-refresh-button:disabled {
    opacity: .45;
    cursor: not-allowed;
}

.session-summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 20px;
}

.session-summary-item strong {
    display: block;
    font-size: 22px;
    margin-bottom: 4px;
}

.session-list {
    display: grid;
    gap: 13px;
}

.session-card {
    display: flex;
    gap: 15px;
    padding: 17px;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 14px;
    background: rgba(100, 116, 139, .025);
}

.session-card.current {
    border-color: rgba(99, 102, 241, .42);
    background: rgba(99, 102, 241, .045);
}

.session-card.revoked {
    opacity: .62;
}

.session-device-icon {
    width: 48px;
    height: 48px;
    flex: 0 0 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 13px;
    background: rgba(99, 102, 241, .11);
}

.session-details {
    min-width: 0;
    flex: 1;
}

.session-title-row {
    display: flex;
    justify-content: space-between;
    gap: 15px;
}

.session-title-row h3 {
    margin: 0 0 7px;
    font-size: 15px;
}

.session-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.status-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    width: fit-content;
    border-radius: 999px;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 700;
}

.status-badge.success {
    background: rgba(34, 197, 94, .10);
}

.status-badge.current {
    background: rgba(99, 102, 241, .12);
}

.status-badge.revoked {
    background: rgba(239, 68, 68, .10);
}

.session-meta-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 13px 20px;
    margin-top: 16px;
}

.session-meta-grid strong {
    display: block;
    font-size: 12px;
    line-height: 1.5;
    word-break: break-word;
}

.session-loading,
.session-empty {
    min-height: 220px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    text-align: center;
    opacity: .7;
}

.session-empty h3 {
    margin: 12px 0 5px;
}

.session-empty p {
    margin: 0 0 15px;
}

.security-list {
    display: grid;
    gap: 10px;
}

.security-row {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr) auto;
    gap: 13px;
    align-items: center;
    padding: 14px;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 12px;
}

.security-row-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(99, 102, 241, .10);
}

.security-row strong,
.security-row span {
    display: block;
}

.security-row strong {
    font-size: 14px;
    margin-bottom: 4px;
}

.security-row > div:nth-child(2) span {
    font-size: 12px;
    opacity: .64;
}

.password-rules {
    display: grid;
    gap: 5px;
    padding: 13px 14px;
    border-radius: 10px;
    background: rgba(100, 116, 139, .06);
    font-size: 12px;
}

.settings-refresh-button .spin {
    animation: settingsSpin .8s linear infinite;
}

@keyframes settingsSpin {
    to { transform: rotate(360deg); }
}

@media (max-width: 900px) {
    .settings-layout {
        grid-template-columns: 1fr;
    }

    .settings-menu {
        position: static;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 5px;
    }

    .session-title-row {
        flex-direction: column;
    }
}

@media (max-width: 640px) {
    .settings-card {
        padding: 17px;
    }

    .settings-header {
        align-items: flex-start;
        flex-direction: column;
    }

    .settings-menu {
        grid-template-columns: 1fr;
    }

    .settings-user-meta,
    .session-summary,
    .session-meta-grid {
        grid-template-columns: 1fr;
    }

    .session-card {
        flex-direction: column;
    }

    .security-row {
        grid-template-columns: 40px minmax(0, 1fr);
    }

    .security-row .status-badge,
    .security-row button {
        grid-column: 2;
        justify-self: start;
    }
}
`;

function Students() {
  const navigate = useNavigate();
  const { user, logoutUser } = useAuth();

  const [students, setStudents] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [selectedStudent, setSelectedStudent] = useState(null);

  const [showForm, setShowForm] = useState(false);

  const [search, setSearch] = useState("");

  const [menuOpen, setMenuOpen] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [darkMode, setDarkMode] = useState(false);

  const menuRef = useRef(null);

  // =====================================================
  // PAGE / SETTINGS STATE
  // =====================================================

  const [activePage, setActivePage] = useState("dashboard");

  const [settingsTab, setSettingsTab] = useState("account");

  const [sessions, setSessions] = useState([]);

  const [sessionsLoading, setSessionsLoading] = useState(false);

  const [sessionsError, setSessionsError] = useState("");

  const [currentSessionId, setCurrentSessionId] = useState(null);

  const [accountForm, setAccountForm] = useState({
    username: user?.username || "",
    email: user?.email || "",
  });

  const [accountSaving, setAccountSaving] = useState(false);

  const [accountMessage, setAccountMessage] = useState("");

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [passwordSaving, setPasswordSaving] = useState(false);

  const [passwordMessage, setPasswordMessage] = useState("");

  const [passwordError, setPasswordError] = useState("");

  // =====================================================
  // LOAD STUDENTS
  // =====================================================

  const loadStudents = async () => {
    try {
      setLoading(true);

      setError("");

      const data = await getStudents();

      setStudents(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);

      setError(
        error.response?.data?.message || "Không thể kết nối đến Backend.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  useEffect(() => {
    setAccountForm({
      username: user?.username || "",
      email: user?.email || "",
    });
  }, [user]);

  // =====================================================
  // CLOSE USER MENU WHEN CLICK OUTSIDE
  // =====================================================

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // =====================================================
  // FILTER STUDENTS
  // =====================================================

  const filteredStudents = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return students;
    }

    return students.filter((student) => {
      return (
        String(student.student_code || "")
          .toLowerCase()
          .includes(keyword) ||
        String(student.name || "")
          .toLowerCase()
          .includes(keyword) ||
        String(student.email || "")
          .toLowerCase()
          .includes(keyword) ||
        String(student.class_code || "")
          .toLowerCase()
          .includes(keyword) ||
        String(student.class_name || "")
          .toLowerCase()
          .includes(keyword)
      );
    });
  }, [students, search]);

  // =====================================================
  // STATISTICS
  // =====================================================

  const statistics = useMemo(() => {
    const classes = new Set(
      students.map((student) => student.class_code).filter(Boolean),
    );

    const male = students.filter(
      (student) => String(student.gender).toLowerCase() === "male",
    ).length;

    const female = students.filter(
      (student) => String(student.gender).toLowerCase() === "female",
    ).length;

    return {
      totalStudents: students.length,

      totalClasses: classes.size,

      male,

      female,
    };
  }, [students]);

  // =====================================================
  // CLASS STATISTICS
  // =====================================================

  const classStatistics = useMemo(() => {
    const map = {};

    students.forEach((student) => {
      const code = student.class_code || "Chưa phân lớp";

      const name = student.class_name || "";

      if (!map[code]) {
        map[code] = {
          code,
          name,
          count: 0,
        };
      }

      map[code].count++;
    });

    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [students]);

  // =====================================================
  // DECODE CURRENT ACCESS TOKEN
  // =====================================================

  const getCurrentSessionFromToken = () => {
    try {
      const token = localStorage.getItem("accessToken");

      if (!token) {
        return null;
      }

      const parts = token.split(".");

      if (parts.length !== 3) {
        return null;
      }

      const payload = JSON.parse(
        decodeURIComponent(
          atob(
            parts[1]
              .replace(/-/g, "+")
              .replace(/_/g, "/")
              .padEnd(parts[1].length + ((4 - (parts[1].length % 4)) % 4), "="),
          )
            .split("")
            .map(
              (char) =>
                "%" + ("00" + char.charCodeAt(0).toString(16)).slice(-2),
            )
            .join(""),
        ),
      );

      return payload;
    } catch (error) {
      console.error("Không thể đọc access token:", error);

      return null;
    }
  };

  // =====================================================
  // LOAD SESSIONS
  // =====================================================

  const loadSessions = async () => {
    try {
      setSessionsLoading(true);
      setSessionsError("");

      const data = await getSessionsApi();

      const sessionList = Array.isArray(data)
        ? data
        : Array.isArray(data?.sessions)
          ? data.sessions
          : [];

      setSessions(sessionList);

      const payload = getCurrentSessionFromToken();

      setCurrentSessionId(payload?.sessionId || payload?.session_id || null);
    } catch (error) {
      console.error("LOAD SESSIONS ERROR:", error);

      setSessionsError(
        error.response?.data?.message ||
          "Không thể tải danh sách phiên đăng nhập.",
      );
    } finally {
      setSessionsLoading(false);
    }
  };

  // =====================================================
  // OPEN SETTINGS
  // =====================================================

  const openSettings = (tab = "account") => {
    setActivePage("settings");

    setSettingsTab(tab);

    setMenuOpen(false);

    setSidebarOpen(false);

    if (tab === "sessions") {
      loadSessions();
    }
  };

  // =====================================================
  // REVOKE SESSION
  // =====================================================

  const handleRevokeSession = async (sessionId) => {
    if (!sessionId) {
      return;
    }

    const confirmed = window.confirm("Bạn có chắc muốn đăng xuất phiên này?");

    if (!confirmed) {
      return;
    }

    try {
      await revokeSessionApi(sessionId);

      await loadSessions();
    } catch (error) {
      console.error("REVOKE SESSION ERROR:", error);

      alert(error.response?.data?.message || "Không thể đăng xuất phiên này.");
    }
  };

  // =====================================================
  // REVOKE OTHER SESSIONS
  // =====================================================

  const handleRevokeOtherSessions = async () => {
    const confirmed = window.confirm(
      "Bạn có chắc muốn đăng xuất tất cả thiết bị khác?",
    );

    if (!confirmed) {
      return;
    }

    try {
      await revokeOtherSessionsApi();

      await loadSessions();
    } catch (error) {
      console.error("REVOKE OTHER SESSIONS ERROR:", error);

      alert(
        error.response?.data?.message ||
          "Không thể đăng xuất các thiết bị khác.",
      );
    }
  };

  // =====================================================
  // UPDATE ACCOUNT
  // =====================================================

  const handleUpdateAccount = async (event) => {
    event.preventDefault();

    setAccountSaving(true);
    setAccountMessage("");

    try {
      const accessToken = localStorage.getItem("accessToken");

      await axios.patch(
        "http://localhost:3000/api/auth/me",
        {
          username: accountForm.username,
          email: accountForm.email,
        },
        {
          withCredentials: true,
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      setAccountMessage("Cập nhật thông tin tài khoản thành công.");
    } catch (error) {
      console.error("UPDATE ACCOUNT ERROR:", error);

      setAccountMessage(
        error.response?.data?.message || "Cập nhật tài khoản thất bại.",
      );
    } finally {
      setAccountSaving(false);
    }
  };

  // =====================================================
  // CHANGE PASSWORD
  // =====================================================

  const handleChangePassword = async (event) => {
    event.preventDefault();

    setPasswordMessage("");
    setPasswordError("");

    if (
      !passwordForm.currentPassword ||
      !passwordForm.newPassword ||
      !passwordForm.confirmPassword
    ) {
      setPasswordError("Vui lòng nhập đầy đủ thông tin.");

      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Mật khẩu xác nhận không khớp.");

      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError("Mật khẩu mới phải có ít nhất 8 ký tự.");

      return;
    }

    try {
      setPasswordSaving(true);

      const accessToken = localStorage.getItem("accessToken");

      await axios.post(
        "http://localhost:3000/api/auth/change-password",
        {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        },
        {
          withCredentials: true,
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      setPasswordMessage("Đổi mật khẩu thành công.");

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      console.error("CHANGE PASSWORD ERROR:", error);

      setPasswordError(
        error.response?.data?.message || "Đổi mật khẩu thất bại.",
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  // =====================================================
  // FORMAT SESSION DATE
  // =====================================================

  const formatSessionDate = (value) => {
    if (!value) {
      return "Không có dữ liệu";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Không xác định";
    }

    return date.toLocaleString("vi-VN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  // =====================================================
  // SESSION DEVICE ICON
  // =====================================================

  const getSessionIcon = (session) => {
    const value =
      `${session?.device_name || ""} ${session?.user_agent || ""}`.toLowerCase();

    if (
      value.includes("mobile") ||
      value.includes("android") ||
      value.includes("iphone")
    ) {
      return <Smartphone size={24} />;
    }

    return <Monitor size={24} />;
  };

  // =====================================================
  // ADD
  // =====================================================

  const handleAdd = () => {
    setSelectedStudent(null);

    setShowForm(true);
  };

  // =====================================================
  // EDIT
  // =====================================================

  const handleEdit = (student) => {
    setSelectedStudent(student);

    setShowForm(true);
  };

  // =====================================================
  // DELETE
  // =====================================================

  const handleDelete = async (id) => {
    const confirmed = window.confirm("Bạn có chắc muốn xóa sinh viên này?");

    if (!confirmed) {
      return;
    }

    try {
      await deleteStudent(id);

      await loadStudents();
    } catch (error) {
      console.error(error);

      alert(error.response?.data?.message || "Xóa sinh viên thất bại");
    }
  };

  // =====================================================
  // SUBMIT
  // =====================================================

  const handleSubmit = async (studentData) => {
    try {
      if (selectedStudent) {
        await updateStudent(selectedStudent.id, studentData);
      } else {
        const res = await createStudent(studentData);
        toast.success(res.message);
      }

      setShowForm(false);

      setSelectedStudent(null);

      await loadStudents();
    } catch (error) {
      console.error(error);

      alert(
        error.response?.data?.message ||
          (selectedStudent
            ? "Cập nhật sinh viên thất bại"
            : "Thêm sinh viên thất bại"),
      );
    }
  };

  // =====================================================
  // LOGOUT
  // =====================================================

  const handleLogout = async () => {
    setMenuOpen(false);

    try {
      await logoutUser();

      navigate("/login", {
        replace: true,
      });
    } catch (error) {
      console.error("LOGOUT ERROR:", error);

      // Dù logout API có lỗi,
      // vẫn đưa người dùng về Login
      navigate("/login", {
        replace: true,
      });
    }
  };

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>

        <p>Đang tải dữ liệu...</p>
      </div>
    );
  }

  return (
    <div className={darkMode ? "dashboard dark" : "dashboard"}>
      <style>{settingsStyles}</style>

      {/* =================================================
                MOBILE OVERLAY
            ================================================= */}

      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* =================================================
                SIDEBAR
            ================================================= */}

      <aside className={sidebarOpen ? "sidebar sidebar-open" : "sidebar"}>
        <div className="brand">
          <div className="brand-logo">
            <GraduationCap size={27} />
          </div>

          <div>
            <strong>StudentOS</strong>

            <span>Academic Management</span>
          </div>
        </div>

        {/* NAVIGATION */}

        <nav className="sidebar-nav">
          <div className="nav-section-title">TỔNG QUAN</div>

          <button
            className={
              activePage === "dashboard" ? "nav-item active" : "nav-item"
            }
            onClick={() => {
              setActivePage("dashboard");
              setSidebarOpen(false);
            }}
          >
            <Home size={19} />

            <span>Trang chủ</span>
          </button>

          <button
            className={
              activePage === "students" ? "nav-item active" : "nav-item"
            }
            onClick={() => {
              setActivePage("dashboard");
              setSidebarOpen(false);
            }}
          >
            <Users size={19} />

            <span>Sinh viên</span>

            <span className="nav-badge">{statistics.totalStudents}</span>
          </button>

          <button className="nav-item">
            <Layers size={19} />

            <span>Lớp học</span>
          </button>

          <button className="nav-item">
            <GraduationCap size={19} />

            <span>Khoa - Ngành</span>
          </button>

          <div className="nav-section-title second">QUẢN LÝ ĐÀO TẠO</div>

          <button className="nav-item">
            <BookOpen size={19} />

            <span>Môn học</span>
          </button>

          <button className="nav-item">
            <ClipboardList size={19} />

            <span>Đăng ký học</span>
          </button>

          <button className="nav-item">
            <CalendarDays size={19} />

            <span>Học kỳ</span>
          </button>

          <button className="nav-item">
            <BarChart3 size={19} />

            <span>Báo cáo</span>
          </button>

          <button
            className={
              activePage === "settings" ? "nav-item active" : "nav-item"
            }
            onClick={() => openSettings("account")}
          >
            <Settings size={19} />

            <span>Cài đặt</span>
          </button>
        </nav>

        {/* LEARNING CARD */}

        <div className="learning-card">
          <div className="learning-card-content">
            <span className="learning-label">HỌC TẬP</span>

            <h3>Học tập là hành trình không có điểm dừng</h3>

            <button>
              Khám phá
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="learning-decoration">
            <Sparkles size={70} />
          </div>
        </div>

        {/* SIDEBAR FOOTER */}

        <div className="sidebar-footer">
          <div className="footer-avatar">
            {user?.username?.charAt(0)?.toUpperCase() || "U"}
          </div>

          <div className="footer-user">
            <strong>{user?.username || "User"}</strong>

            <span>
              {user?.role === "admin" ? "Quản trị viên" : "Người dùng"}
            </span>
          </div>
        </div>
      </aside>

      {/* =================================================
                MAIN
            ================================================= */}

      <main className="main-content">
        {/* =================================================
                    HEADER
                ================================================= */}

        <header className="top-header">
          <button
            className="mobile-menu"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu size={22} />
          </button>

          {/* SEARCH */}

          <div className="global-search">
            <Search size={19} />

            <input
              type="text"
              placeholder="Tìm kiếm sinh viên, lớp học, mã sinh viên, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="header-actions">
            {/* NOTIFICATION */}

            <button className="header-icon">
              <Bell size={20} />

              <span className="notification-dot">2</span>
            </button>

            {/* DARK MODE */}

            <button
              className="header-icon"
              onClick={() => setDarkMode(!darkMode)}
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* USER MENU */}

            <div className="user-menu-wrapper" ref={menuRef}>
              <button
                className="user-menu-trigger"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <div className="user-avatar">
                  {user?.username?.charAt(0)?.toUpperCase() || "U"}
                </div>

                <div className="header-user-info">
                  <strong>{user?.username || "User"}</strong>

                  <span>
                    {user?.role === "admin" ? "Quản trị viên" : "Người dùng"}
                  </span>
                </div>

                <MoreVertical size={20} />
              </button>

              {/* DROPDOWN */}

              {menuOpen && (
                <div className="user-dropdown">
                  <div className="dropdown-user">
                    <div className="user-avatar large">
                      {user?.username?.charAt(0)?.toUpperCase() || "U"}
                    </div>

                    <div>
                      <strong>{user?.username || "User"}</strong>

                      <span>{user?.email || "user@example.com"}</span>
                    </div>
                  </div>

                  <div className="dropdown-divider" />

                  <button>
                    <User size={18} />

                    <span>Thông tin người dùng</span>
                  </button>

                  <button onClick={() => openSettings("account")}>
                    <Settings size={18} />

                    <span>Cài đặt tài khoản</span>
                  </button>

                  <div className="dropdown-divider" />

                  <button className="logout-item" onClick={handleLogout}>
                    <LogOut size={18} />

                    <span>Đăng xuất</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* =================================================
                    PAGE CONTENT
                ================================================= */}

        <section className="content">
          {activePage === "dashboard" && (
            <>
              {/* =================================================
                        HERO
                    ================================================= */}

              <div className="welcome-row">
                <div>
                  <div className="welcome-title">
                    <span>👋</span>

                    <h1>Xin chào, {user?.username || "bạn"}!</h1>
                  </div>

                  <p>Chúc bạn có một ngày làm việc hiệu quả.</p>

                  <div className="current-date">
                    <CalendarDays size={16} />

                    {new Date().toLocaleDateString("vi-VN", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                </div>

                {/* QUOTE BANNER */}

                <div className="quote-banner">
                  <div className="quote-overlay"></div>

                  <div className="quote-content">
                    <span>“Tri thức là chìa khóa mở ra tương lai.”</span>

                    <button>
                      Xem thêm
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              </div>

              {/* =================================================
                        STAT CARDS
                    ================================================= */}

              <div className="stats-grid">
                <div className="stat-card blue">
                  <div className="stat-icon">
                    <Users size={23} />
                  </div>

                  <div className="stat-info">
                    <span>Tổng số sinh viên</span>

                    <strong>{statistics.totalStudents}</strong>

                    <small>Sinh viên đang quản lý</small>
                  </div>
                </div>

                <div className="stat-card green">
                  <div className="stat-icon">
                    <BookOpen size={23} />
                  </div>

                  <div className="stat-info">
                    <span>Lớp học</span>

                    <strong>{statistics.totalClasses}</strong>

                    <small>Lớp đang có sinh viên</small>
                  </div>
                </div>

                <div className="stat-card purple">
                  <div className="stat-icon">
                    <User size={23} />
                  </div>

                  <div className="stat-info">
                    <span>Phân bố giới tính</span>

                    <strong>
                      {statistics.male}
                      <small className="inline"> Nam</small>
                    </strong>

                    <small>{statistics.female} nữ</small>
                  </div>
                </div>

                <div className="stat-card orange">
                  <div className="stat-icon">
                    <Sparkles size={23} />
                  </div>

                  <div className="stat-info">
                    <span>Dữ liệu hệ thống</span>

                    <strong>{filteredStudents.length}</strong>

                    <small>Kết quả đang hiển thị</small>
                  </div>
                </div>
              </div>

              {/* =================================================
                        MAIN GRID
                    ================================================= */}

              <div className="dashboard-grid">
                {/* =================================================
                            STUDENT TABLE
                        ================================================= */}

                <div className="panel student-panel">
                  <div className="panel-header">
                    <div>
                      <h2>Danh sách sinh viên</h2>

                      <p>Quản lý thông tin và theo dõi học tập của sinh viên</p>
                    </div>

                    <button className="primary-button" onClick={handleAdd}>
                      <Plus size={18} />
                      Thêm sinh viên
                    </button>
                  </div>

                  {/* SEARCH / FILTER */}

                  <div className="table-toolbar">
                    <div className="table-search">
                      <Search size={17} />

                      <input
                        placeholder="Tìm theo mã, tên, email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />

                      {search && (
                        <button onClick={() => setSearch("")}>
                          <X size={15} />
                        </button>
                      )}
                    </div>

                    <button className="toolbar-button">
                      <Filter size={16} />
                      Bộ lọc
                    </button>

                    <button className="toolbar-button">
                      <ArrowUpDown size={16} />
                      Sắp xếp
                    </button>
                  </div>

                  {error && <div className="dashboard-error">{error}</div>}

                  <div className="student-table-wrapper">
                    <StudentTable
                      students={filteredStudents}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  </div>

                  <div className="table-footer">
                    <span>
                      Hiển thị {filteredStudents.length} trong tổng số{" "}
                      {students.length} sinh viên
                    </span>

                    <div className="pagination">
                      <button>‹</button>

                      <button className="active">1</button>

                      <button>2</button>

                      <button>3</button>

                      <button>…</button>

                      <button>›</button>
                    </div>
                  </div>
                </div>

                {/* =================================================
                            RIGHT SIDE
                        ================================================= */}

                <div className="right-column">
                  {/* RECENT ACTIVITY */}

                  <div className="panel activity-panel">
                    <div className="panel-header compact">
                      <div>
                        <h2>Hoạt động gần đây</h2>
                      </div>

                      <button className="text-button">Xem tất cả</button>
                    </div>

                    <div className="activity-list">
                      <div className="activity-item">
                        <div className="activity-icon green">
                          <Plus size={17} />
                        </div>

                        <div>
                          <strong>Thêm mới sinh viên</strong>

                          <span>Hệ thống quản lý</span>
                        </div>

                        <small>Vừa xong</small>
                      </div>

                      <div className="activity-item">
                        <div className="activity-icon blue">
                          <Pencil size={16} />
                        </div>

                        <div>
                          <strong>Cập nhật thông tin</strong>

                          <span>Dữ liệu sinh viên</span>
                        </div>

                        <small>Gần đây</small>
                      </div>

                      <div className="activity-item">
                        <div className="activity-icon purple">
                          <ClipboardList size={16} />
                        </div>

                        <div>
                          <strong>Quản lý đăng ký học</strong>

                          <span>Theo dõi học tập</span>
                        </div>

                        <small>Hôm nay</small>
                      </div>

                      <div className="activity-item">
                        <div className="activity-icon orange">
                          <Users size={16} />
                        </div>

                        <div>
                          <strong>Quản lý sinh viên</strong>

                          <span>Danh sách hiện tại</span>
                        </div>

                        <small>Hôm nay</small>
                      </div>
                    </div>
                  </div>

                  {/* CLASS DISTRIBUTION */}

                  <div className="panel class-panel">
                    <div className="panel-header compact">
                      <div>
                        <h2>Sinh viên theo lớp</h2>
                      </div>

                      <button className="text-button">Xem chi tiết</button>
                    </div>

                    <div className="class-chart">
                      {classStatistics.length === 0 ? (
                        <div className="empty-chart">Chưa có dữ liệu lớp</div>
                      ) : (
                        classStatistics.slice(0, 5).map((item, index) => {
                          const max = Math.max(
                            ...classStatistics.map((x) => x.count),
                          );

                          const width = max > 0 ? (item.count / max) * 100 : 0;

                          return (
                            <div className="class-row" key={item.code}>
                              <div className="class-row-info">
                                <span>{item.code}</span>

                                <strong>{item.count}</strong>
                              </div>

                              <div className="class-progress">
                                <span
                                  style={{
                                    width: `${width}%`,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* QUICK ACTION */}

                  <div className="quick-card">
                    <div className="quick-card-icon">
                      <GraduationCap size={25} />
                    </div>

                    <div>
                      <h3>Quản lý đào tạo</h3>

                      <p>Theo dõi lớp học, môn học và đăng ký học tập.</p>
                    </div>

                    <ChevronRight />
                  </div>
                </div>
              </div>

              {/* =================================================
                        MODAL FORM
                    ================================================= */}

              {showForm && (
                <div className="modal-backdrop">
                  <div className="student-modal">
                    <div className="modal-header">
                      <div>
                        <span>QUẢN LÝ SINH VIÊN</span>

                        <h2>
                          {selectedStudent
                            ? "Cập nhật sinh viên"
                            : "Thêm sinh viên"}
                        </h2>
                      </div>

                      <button
                        className="modal-close"
                        onClick={() => {
                          setShowForm(false);

                          setSelectedStudent(null);
                        }}
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <div className="modal-body">
                      <StudentForm
                        student={selectedStudent}
                        onSubmit={handleSubmit}
                        onCancel={() => {
                          setShowForm(false);

                          setSelectedStudent(null);
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* =================================================
                        SETTINGS
                    ================================================= */}

          {activePage === "settings" && (
            <div className="settings-page">
              <div className="settings-header">
                <div>
                  <span className="settings-kicker">ACCOUNT & SECURITY</span>

                  <h1>Cài đặt tài khoản</h1>

                  <p>
                    Quản lý thông tin tài khoản, bảo mật và các phiên đăng nhập.
                  </p>
                </div>

                {settingsTab === "sessions" && (
                  <button
                    className="settings-refresh-button"
                    onClick={loadSessions}
                    disabled={sessionsLoading}
                  >
                    <RefreshCw
                      size={17}
                      className={sessionsLoading ? "spin" : ""}
                    />
                    Làm mới
                  </button>
                )}
              </div>

              <div className="settings-layout">
                {/* SETTINGS MENU */}

                <aside className="settings-menu">
                  <button
                    className={
                      settingsTab === "account"
                        ? "settings-menu-item active"
                        : "settings-menu-item"
                    }
                    onClick={() => setSettingsTab("account")}
                  >
                    <User size={18} />
                    <span>Tài khoản</span>
                  </button>

                  <button
                    className={
                      settingsTab === "security"
                        ? "settings-menu-item active"
                        : "settings-menu-item"
                    }
                    onClick={() => setSettingsTab("security")}
                  >
                    <ShieldCheck size={18} />
                    <span>Bảo mật</span>
                  </button>

                  <button
                    className={
                      settingsTab === "sessions"
                        ? "settings-menu-item active"
                        : "settings-menu-item"
                    }
                    onClick={() => {
                      setSettingsTab("sessions");
                      loadSessions();
                    }}
                  >
                    <Monitor size={18} />
                    <span>Phiên đăng nhập</span>

                    {sessions.length > 0 && (
                      <span className="settings-count">
                        {
                          sessions.filter((session) => !session.revoked_at)
                            .length
                        }
                      </span>
                    )}
                  </button>

                  <button
                    className={
                      settingsTab === "password"
                        ? "settings-menu-item active"
                        : "settings-menu-item"
                    }
                    onClick={() => setSettingsTab("password")}
                  >
                    <KeyRound size={18} />
                    <span>Đổi mật khẩu</span>
                  </button>
                </aside>

                {/* SETTINGS CONTENT */}

                <div className="settings-content">
                  {/* =====================================
                                        ACCOUNT
                                    ===================================== */}

                  {settingsTab === "account" && (
                    <div className="settings-card">
                      <div className="settings-card-header">
                        <div className="settings-card-icon">
                          <User size={20} />
                        </div>

                        <div>
                          <h2>Thông tin tài khoản</h2>

                          <p>Cập nhật thông tin cơ bản của tài khoản.</p>
                        </div>
                      </div>

                      <form
                        className="settings-form"
                        onSubmit={handleUpdateAccount}
                      >
                        <div className="settings-field">
                          <label>Username</label>

                          <div className="settings-input-wrap">
                            <User size={17} />

                            <input
                              type="text"
                              value={accountForm.username}
                              onChange={(event) =>
                                setAccountForm({
                                  ...accountForm,
                                  username: event.target.value,
                                })
                              }
                              required
                            />
                          </div>
                        </div>

                        <div className="settings-field">
                          <label>Email</label>

                          <div className="settings-input-wrap">
                            <Mail size={17} />

                            <input
                              type="email"
                              value={accountForm.email}
                              onChange={(event) =>
                                setAccountForm({
                                  ...accountForm,
                                  email: event.target.value,
                                })
                              }
                              required
                            />
                          </div>
                        </div>

                        <div className="settings-user-meta">
                          <div>
                            <span>Role</span>
                            <strong>{user?.role || "user"}</strong>
                          </div>

                          <div>
                            <span>User ID</span>
                            <strong>{user?.id || user?.userId || "—"}</strong>
                          </div>
                        </div>

                        {accountMessage && (
                          <div className="settings-message">
                            <CheckCircle2 size={17} />
                            {accountMessage}
                          </div>
                        )}

                        <div className="settings-actions">
                          <button
                            type="submit"
                            className="primary-button"
                            disabled={accountSaving}
                          >
                            <Save size={17} />

                            {accountSaving ? "Đang lưu..." : "Lưu thay đổi"}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* =====================================
                                        SECURITY
                                    ===================================== */}

                  {settingsTab === "security" && (
                    <div className="settings-card">
                      <div className="settings-card-header">
                        <div className="settings-card-icon">
                          <ShieldCheck size={20} />
                        </div>

                        <div>
                          <h2>Bảo mật</h2>

                          <p>
                            Thông tin trạng thái bảo mật của phiên hiện tại.
                          </p>
                        </div>
                      </div>

                      <div className="security-list">
                        <div className="security-row">
                          <div className="security-row-icon">
                            <ShieldCheck size={20} />
                          </div>

                          <div>
                            <strong>Authentication</strong>

                            <span>
                              Tài khoản đang sử dụng JWT Authentication.
                            </span>
                          </div>

                          <span className="status-badge success">
                            Hoạt động
                          </span>
                        </div>

                        <div className="security-row">
                          <div className="security-row-icon">
                            <KeyRound size={20} />
                          </div>

                          <div>
                            <strong>Access Token</strong>

                            <span>
                              Access token được gửi trong Authorization Bearer
                              header.
                            </span>
                          </div>

                          <span className="status-badge success">JWT</span>
                        </div>

                        <div className="security-row">
                          <div className="security-row-icon">
                            <Clock3 size={20} />
                          </div>

                          <div>
                            <strong>Refresh Token</strong>

                            <span>
                              Refresh token được dùng để duy trì phiên đăng
                              nhập.
                            </span>
                          </div>

                          <span className="status-badge success">Enabled</span>
                        </div>

                        <div className="security-row">
                          <div className="security-row-icon">
                            <Globe size={20} />
                          </div>

                          <div>
                            <strong>Session Management</strong>

                            <span>
                              Mỗi lần đăng nhập được quản lý như một session
                              riêng.
                            </span>
                          </div>

                          <button
                            className="secondary-button"
                            onClick={() => setSettingsTab("sessions")}
                          >
                            Xem session
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* =====================================
                                        SESSIONS
                                    ===================================== */}

                  {settingsTab === "sessions" && (
                    <div className="settings-card">
                      <div className="settings-card-header session-main-header">
                        <div>
                          <div className="settings-card-title-row">
                            <div className="settings-card-icon">
                              <Monitor size={20} />
                            </div>

                            <div>
                              <h2>Phiên đăng nhập</h2>

                              <p>
                                Các thiết bị đang và đã đăng nhập vào tài khoản.
                              </p>
                            </div>
                          </div>
                        </div>

                        <button
                          className="danger-outline-button"
                          onClick={handleRevokeOtherSessions}
                          disabled={
                            sessionsLoading ||
                            sessions.filter(
                              (session) =>
                                !session.revoked_at &&
                                session.id !== currentSessionId,
                            ).length === 0
                          }
                        >
                          <LogOut size={16} />
                          Đăng xuất thiết bị khác
                        </button>
                      </div>

                      <div className="session-summary">
                        <div className="session-summary-item">
                          <strong>
                            {
                              sessions.filter((session) => !session.revoked_at)
                                .length
                            }
                          </strong>

                          <span>Phiên đang hoạt động</span>
                        </div>

                        <div className="session-summary-item">
                          <strong>
                            {
                              sessions.filter((session) => session.revoked_at)
                                .length
                            }
                          </strong>

                          <span>Phiên đã thu hồi</span>
                        </div>

                        <div className="session-summary-item">
                          <strong>{sessions.length}</strong>

                          <span>Tổng số phiên</span>
                        </div>
                      </div>

                      {sessionsError && (
                        <div className="settings-error">
                          <AlertCircle size={18} />

                          {sessionsError}
                        </div>
                      )}

                      {sessionsLoading ? (
                        <div className="session-loading">
                          <div className="loading-spinner"></div>

                          <p>Đang tải danh sách phiên đăng nhập...</p>
                        </div>
                      ) : sessions.length === 0 ? (
                        <div className="session-empty">
                          <Monitor size={42} />

                          <h3>Chưa có dữ liệu session</h3>

                          <p>Không tìm thấy phiên đăng nhập nào.</p>

                          <button
                            className="secondary-button"
                            onClick={loadSessions}
                          >
                            <RefreshCw size={16} />
                            Tải lại
                          </button>
                        </div>
                      ) : (
                        <div className="session-list">
                          {sessions.map((session) => {
                            const isCurrent = session.id === currentSessionId;

                            const isRevoked = Boolean(session.revoked_at);

                            return (
                              <div
                                className={`session-card ${
                                  isCurrent ? "current" : ""
                                } ${isRevoked ? "revoked" : ""}`}
                                key={session.id}
                              >
                                <div className="session-device-icon">
                                  {getSessionIcon(session)}
                                </div>

                                <div className="session-details">
                                  <div className="session-title-row">
                                    <div>
                                      <h3>
                                        {session.device_name ||
                                          "Thiết bị không xác định"}
                                      </h3>

                                      <div className="session-badges">
                                        {isCurrent && (
                                          <span className="status-badge current">
                                            <CheckCircle2 size={13} />
                                            Thiết bị hiện tại
                                          </span>
                                        )}

                                        {!isRevoked && !isCurrent && (
                                          <span className="status-badge success">
                                            Đang hoạt động
                                          </span>
                                        )}

                                        {isRevoked && (
                                          <span className="status-badge revoked">
                                            Đã thu hồi
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {!isCurrent && !isRevoked && (
                                      <button
                                        className="session-revoke-button"
                                        onClick={() =>
                                          handleRevokeSession(session.id)
                                        }
                                      >
                                        <LogOut size={16} />
                                        Đăng xuất
                                      </button>
                                    )}
                                  </div>

                                  <div className="session-meta-grid">
                                    <div>
                                      <span>Trình duyệt</span>

                                      <strong>
                                        {session.user_agent || "Không xác định"}
                                      </strong>
                                    </div>

                                    <div>
                                      <span>Địa chỉ IP</span>

                                      <strong>
                                        {session.ip_address || "Không xác định"}
                                      </strong>
                                    </div>

                                    <div>
                                      <span>Đăng nhập</span>

                                      <strong>
                                        {formatSessionDate(session.created_at)}
                                      </strong>
                                    </div>

                                    <div>
                                      <span>Hoạt động cuối</span>

                                      <strong>
                                        {formatSessionDate(
                                          session.last_used_at,
                                        )}
                                      </strong>
                                    </div>

                                    {isRevoked && (
                                      <div>
                                        <span>Thu hồi</span>

                                        <strong>
                                          {formatSessionDate(
                                            session.revoked_at,
                                          )}
                                        </strong>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* =====================================
                                        CHANGE PASSWORD
                                    ===================================== */}

                  {settingsTab === "password" && (
                    <div className="settings-card">
                      <div className="settings-card-header">
                        <div className="settings-card-icon">
                          <KeyRound size={20} />
                        </div>

                        <div>
                          <h2>Đổi mật khẩu</h2>

                          <p>
                            Sử dụng mật khẩu mạnh và không chia sẻ mật khẩu với
                            người khác.
                          </p>
                        </div>
                      </div>

                      <form
                        className="settings-form"
                        onSubmit={handleChangePassword}
                      >
                        <div className="settings-field">
                          <label>Mật khẩu hiện tại</label>

                          <div className="settings-input-wrap">
                            <KeyRound size={17} />

                            <input
                              type="password"
                              value={passwordForm.currentPassword}
                              onChange={(event) =>
                                setPasswordForm({
                                  ...passwordForm,
                                  currentPassword: event.target.value,
                                })
                              }
                              autoComplete="current-password"
                            />
                          </div>
                        </div>

                        <div className="settings-field">
                          <label>Mật khẩu mới</label>

                          <div className="settings-input-wrap">
                            <KeyRound size={17} />

                            <input
                              type="password"
                              value={passwordForm.newPassword}
                              onChange={(event) =>
                                setPasswordForm({
                                  ...passwordForm,
                                  newPassword: event.target.value,
                                })
                              }
                              autoComplete="new-password"
                            />
                          </div>
                        </div>

                        <div className="settings-field">
                          <label>Xác nhận mật khẩu mới</label>

                          <div className="settings-input-wrap">
                            <KeyRound size={17} />

                            <input
                              type="password"
                              value={passwordForm.confirmPassword}
                              onChange={(event) =>
                                setPasswordForm({
                                  ...passwordForm,
                                  confirmPassword: event.target.value,
                                })
                              }
                              autoComplete="new-password"
                            />
                          </div>
                        </div>

                        {passwordError && (
                          <div className="settings-error">
                            <AlertCircle size={17} />

                            {passwordError}
                          </div>
                        )}

                        {passwordMessage && (
                          <div className="settings-message">
                            <CheckCircle2 size={17} />

                            {passwordMessage}
                          </div>
                        )}

                        <div className="password-rules">
                          <strong>Yêu cầu mật khẩu</strong>

                          <span>• Ít nhất 8 ký tự</span>

                          <span>• Không sử dụng mật khẩu quá dễ đoán</span>
                        </div>

                        <div className="settings-actions">
                          <button
                            type="submit"
                            className="primary-button"
                            disabled={passwordSaving}
                          >
                            <KeyRound size={17} />

                            {passwordSaving
                              ? "Đang cập nhật..."
                              : "Đổi mật khẩu"}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Students;
