import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from 'sonner';
import { useAuth } from "@/hooks/useAuth.js";
import { useStudents } from "@/hooks/useStudents.js";
import { useStudentSettings } from "@/hooks/useStudentSettings.js";

import StudentHeader from "@/components/layout/StudentHeader.jsx";
import StudentSidebar from "@/components/layout/StudentSidebar.jsx";
import StudentDashboard from "@/components/students/StudentDashboard.jsx";
import SettingsPage from "@/components/settings/SettingsPage.jsx";
import AccountSettings from "@/components/settings/AccountSettings.jsx";
import SecuritySettings from "@/components/settings/SecuritySettings.jsx";
import SessionSettings from "@/components/settings/SessionSettings.jsx";
import PasswordSettings from "@/components/settings/PasswordSettings.jsx";

import {
  createStudent,
  updateStudent,
  deleteStudent,
} from "@/api/studentApi.js";

import "@/styles/students.css";

import "@/styles/settings.css";


function Students() {
  const navigate = useNavigate();
  const { user, logoutUser } = useAuth();

  const [selectedStudent, setSelectedStudent] = useState(null);

  const [showForm, setShowForm] = useState(false);

  const [search, setSearch] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [darkMode, setDarkMode] = useState(false);

  const {
    students,
    loading,
    error,
    loadStudents,
    filteredStudents,
    statistics,
    classStatistics,
  } = useStudents(search);

  // =====================================================
  // PAGE / SETTINGS STATE
  // =====================================================

  const [activePage, setActivePage] = useState("dashboard");

  const {
    settingsTab,
    setSettingsTab,
    sessions,
    sessionsLoading,
    sessionsError,
    currentSessionId,
    accountForm,
    setAccountForm,
    accountSaving,
    accountMessage,
    passwordForm,
    setPasswordForm,
    passwordSaving,
    passwordMessage,
    passwordError,
    loadSessions,
    handleRevokeSession,
    handleRevokeOtherSessions,
    handleUpdateAccount,
    handleChangePassword,
    formatSessionDate,
    getSessionIcon,
  } = useStudentSettings(user);

  // =====================================================
  // OPEN SETTINGS
  // =====================================================

  const openSettings = (tab = "account") => {
    setActivePage("settings");

    setSettingsTab(tab);

    setSidebarOpen(false);

    if (tab === "sessions") {
      loadSessions();
    }
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
      <StudentSidebar
        user={user}
        activePage={activePage}
        totalStudents={statistics.totalStudents}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNavigate={() => {
          setActivePage("dashboard");
          setSidebarOpen(false);
        }}
        onOpenSettings={() => openSettings("account")}
      />

      {/* =================================================
                MAIN
            ================================================= */}

      <main className="main-content">
        {/* =================================================
                    HEADER
                ================================================= */}

        <StudentHeader
          user={user}
          search={search}
          onSearchChange={setSearch}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((current) => !current)}
          onOpenSettings={() => openSettings("account")}
          onLogout={handleLogout}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
        />

        {/* =================================================
                    PAGE CONTENT
                ================================================= */}

        <section className="content">
          {activePage === "dashboard" && (
            <StudentDashboard
              user={user}
              statistics={statistics}
              filteredCount={filteredStudents.length}
              students={students}
              filteredStudents={filteredStudents}
              error={error}
              search={search}
              onSearchChange={setSearch}
              onAdd={handleAdd}
              onEdit={handleEdit}
              onDelete={handleDelete}
              classStatistics={classStatistics}
              showForm={showForm}
              selectedStudent={selectedStudent}
              onSubmit={handleSubmit}
              onCloseForm={() => {
                setShowForm(false);
                setSelectedStudent(null);
              }}
            />
          )}

          {/* =================================================
                        SETTINGS
                    ================================================= */}

          {activePage === "settings" && (
            <SettingsPage
              activeTab={settingsTab}
              onTabChange={(tab) => {
                setSettingsTab(tab);
                if (tab === "sessions") loadSessions();
              }}
              activeSessions={sessions.filter((session) => !session.revoked_at).length}
              loading={sessionsLoading}
              onRefresh={loadSessions}
            >
                <div className="settings-content">
                  {/* =====================================
                                        ACCOUNT
                                    ===================================== */}

                  {settingsTab === "account" && (
                    <AccountSettings
                      user={user}
                      form={accountForm}
                      onChange={setAccountForm}
                      onSubmit={handleUpdateAccount}
                      saving={accountSaving}
                      message={accountMessage}
                    />
                  )}

                  {/* =====================================
                                        SECURITY
                                    ===================================== */}

                  {settingsTab === "security" && (
                    <SecuritySettings onOpenSessions={() => setSettingsTab("sessions")} />
                  )}

                  {/* =====================================
                                        SESSIONS
                                    ===================================== */}

                  {settingsTab === "sessions" && (
                    <SessionSettings
                      sessions={sessions}
                      loading={sessionsLoading}
                      error={sessionsError}
                      currentSessionId={currentSessionId}
                      onRefresh={loadSessions}
                      onRevoke={handleRevokeSession}
                      onRevokeOthers={handleRevokeOtherSessions}
                      formatDate={formatSessionDate}
                      getDeviceIcon={getSessionIcon}
                    />
                  )}

                  {/* =====================================
                                        CHANGE PASSWORD
                                    ===================================== */}

                  {settingsTab === "password" && (
                    <PasswordSettings
                      form={passwordForm}
                      onChange={setPasswordForm}
                      onSubmit={handleChangePassword}
                      saving={passwordSaving}
                      message={passwordMessage}
                      error={passwordError}
                    />
                  )}
                </div>
            </SettingsPage>
          )}
        </section>
      </main>
    </div>
  );
}

export default Students;
