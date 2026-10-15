import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth.js";
import { useTheme } from "@/context/ThemeContext.jsx";
import { useStudents } from "@/hooks/useStudents.js";
import { useStudentSettings } from "@/hooks/useStudentSettings.js";

import StudentHeader from "@/components/layout/StudentHeader.jsx";
import StudentSidebar from "@/components/layout/StudentSidebar.jsx";
import StudentDashboard from "@/components/students/StudentDashboard.jsx";
import AdminOverview from "@/components/students/AdminOverview.jsx";
import StudentPortalOverview from "@/components/students/StudentPortalOverview.jsx";
import SettingsPage from "@/components/settings/SettingsPage.jsx";
import AccountSettings from "@/components/settings/AccountSettings.jsx";
import SecuritySettings from "@/components/settings/SecuritySettings.jsx";
import SessionSettings from "@/components/settings/SessionSettings.jsx";
import PasswordSettings from "@/components/settings/PasswordSettings.jsx";
import NotificationSettings from "@/components/settings/NotificationSettings.jsx";
import AppearanceSettings from "@/components/settings/AppearanceSettings.jsx";
import LanguageSettings from "@/components/settings/LanguageSettings.jsx";

import {
  createStudent,
  updateStudent,
  deleteStudent,
} from "@/api/studentApi.js";

function Students() {
  const navigate = useNavigate();

  // =====================================================
  // URL SEARCH PARAMS
  // =====================================================

  const [searchParams, setSearchParams] = useSearchParams();

  const { user, logoutUser, updateUser } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const isAdmin = user?.role === "admin";

  // =====================================================
  // READ PAGINATION FROM URL
  // =====================================================

  const rawPage = Number(searchParams.get("page"));
  const rawPageSize = Number(searchParams.get("pageSize"));

  const currentPage =
    Number.isInteger(rawPage) && rawPage >= 1
      ? rawPage
      : 1;

  const pageSize = [10, 25, 50].includes(rawPageSize)
    ? rawPageSize
    : 10;

  const search = searchParams.get("search") || "";

  // =====================================================
  // STUDENT STATE
  // =====================================================

  const [selectedStudent, setSelectedStudent] = useState(null);

  const [showForm, setShowForm] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("studentos-sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });

  const toggleDesktopSidebar = () => {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      try {
        localStorage.setItem("studentos-sidebar-collapsed", String(next));
      } catch {
        // Keep the UI functional when storage is unavailable.
      }
      return next;
    });
  };


  // =====================================================
  // STUDENTS HOOK
  // =====================================================

  const {
    students,
    loading,
    error,
    loadStudents,
    filteredStudents,
    statistics,
    classStatistics,
  } = useStudents(search, isAdmin);

  // =====================================================
  // PAGINATION
  // =====================================================

  const pageCount = Math.max(
    1,
    Math.ceil(filteredStudents.length / pageSize)
  );

  /*
   * Nếu URL chứa page quá lớn
   * thì chỉ dùng visiblePage để render.
   *
   * Ví dụ:
   * /students?page=999
   *
   * nhưng chỉ có 3 trang
   * => visiblePage = 3
   */
  const visiblePage = Math.max(
    1,
    Math.min(currentPage, pageCount)
  );

  const firstStudentIndex = filteredStudents.length
    ? (visiblePage - 1) * pageSize + 1
    : 0;

  const lastStudentIndex = Math.min(
    visiblePage * pageSize,
    filteredStudents.length
  );

  const paginatedStudents = filteredStudents.slice(
    firstStudentIndex - 1,
    lastStudentIndex
  );

  // =====================================================
  // FIX INVALID PAGE IN URL
  // =====================================================

  useEffect(() => {
    if (loading) {
      return;
    }

    /*
     * Nếu URL đang:
     *
     * ?page=999
     *
     * nhưng dữ liệu chỉ có 3 trang
     *
     * thì sửa URL thành:
     *
     * ?page=3
     */

    if (currentPage !== visiblePage) {
      const params = new URLSearchParams(searchParams);

      params.set("page", String(visiblePage));
      params.set("pageSize", String(pageSize));

      if (search) {
        params.set("search", search);
      } else {
        params.delete("search");
      }

      setSearchParams(params, {
        replace: true,
      });
    }
  }, [
    loading,
    currentPage,
    visiblePage,
    pageSize,
    search,
    searchParams,
    setSearchParams,
  ]);

  // =====================================================
  // SEARCH
  // =====================================================

  const handleSearchChange = (value) => {
    if (isAdmin && value.trim()) {
      setActivePage("students");
    }

    const params = new URLSearchParams(searchParams);
    if (isAdmin && value.trim()) params.set("view", "students");

    if (value.trim()) {
      params.set("search", value);
    } else {
      params.delete("search");
    }

    /*
     * Khi search mới
     * luôn quay về trang 1.
     */
    params.set("page", "1");

    /*
     * Giữ nguyên pageSize.
     */
    params.set("pageSize", String(pageSize));

    setSearchParams(params);
  };

  // =====================================================
  // PAGE CHANGE
  // =====================================================

  const handlePageChange = (page) => {
    const safePage = Math.max(
      1,
      Math.min(page, pageCount)
    );

    const params = new URLSearchParams(searchParams);

    params.set("page", String(safePage));
    params.set("pageSize", String(pageSize));

    if (search) {
      params.set("search", search);
    } else {
      params.delete("search");
    }

    setSearchParams(params);
  };

  // =====================================================
  // PAGE SIZE CHANGE
  // =====================================================

  const handlePageSizeChange = (size) => {
    const validPageSizes = [10, 25, 50];

    const parsedSize = Number(size);

    const safePageSize = validPageSizes.includes(parsedSize)
      ? parsedSize
      : 10;

    const params = new URLSearchParams(searchParams);

    params.set("pageSize", String(safePageSize));

    /*
     * Khi đổi pageSize
     * quay về trang 1.
     */
    params.set("page", "1");

    if (search) {
      params.set("search", search);
    } else {
      params.delete("search");
    }

    setSearchParams(params);
  };

  // =====================================================
  // PAGE / SETTINGS STATE
  // =====================================================

  const [activePage, setActivePage] = useState(() => {
    const requestedView = searchParams.get("view");
    if (requestedView === "settings") return "settings";
    if (requestedView === "students" || (isAdmin && searchParams.has("search"))) return "students";
    return "dashboard";
  });

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
    const allowedTabs = ["account", "notifications", "security", "sessions", "password", "appearance", "language"];
    const nextTab = allowedTabs.includes(tab) ? tab : "account";
    setActivePage("settings");
    setSettingsTab(nextTab);
    setSidebarOpen(false);

    const params = new URLSearchParams(searchParams);
    params.set("view", "settings");
    params.set("tab", nextTab);
    setSearchParams(params);

    if (nextTab === "sessions") {
      loadSessions();
    }
  };

  useEffect(() => {
    if (searchParams.get("view") !== "settings") return;
    const requestedTab = searchParams.get("tab");
    const allowedTabs = ["account", "notifications", "security", "sessions", "password", "appearance", "language"];
    if (allowedTabs.includes(requestedTab) && requestedTab !== settingsTab) {
      setSettingsTab(requestedTab);
      if (requestedTab === "sessions") loadSessions();
    }
  }, [searchParams]);

  // =====================================================
  // ADD STUDENT
  // =====================================================

  const handleAdd = () => {
    if (!isAdmin) return;
    setSelectedStudent(null);

    setShowForm(true);
  };

  // =====================================================
  // EDIT STUDENT
  // =====================================================

  const handleEdit = (student) => {
    if (!isAdmin) return;
    setSelectedStudent(student);

    setShowForm(true);
  };

  // =====================================================
  // DELETE STUDENT
  // =====================================================

  const handleDelete = async (id) => {
    if (!isAdmin) {
      toast.error("Bạn không có quyền quản lý sinh viên");
      return;
    }

    const confirmed = window.confirm(
      "Bạn có chắc muốn xóa sinh viên này?"
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteStudent(id);

      await loadStudents();

      toast.success("Xóa sinh viên thành công");
    } catch (error) {
      console.error(error);

      toast.error(
        error.response?.data?.message ||
          "Xóa sinh viên thất bại"
      );
    }
  };

  // =====================================================
  // CREATE / UPDATE STUDENT
  // =====================================================

  const handleSubmit = async (studentData) => {
    if (!isAdmin) {
      toast.error("Bạn không có quyền quản lý sinh viên");
      return;
    }

    try {
      if (selectedStudent) {
        await updateStudent(
          selectedStudent.id,
          studentData
        );

        toast.success(
          "Cập nhật sinh viên thành công"
        );
      } else {
        const res = await createStudent(studentData);

        toast.success(
          res?.message ||
            "Thêm sinh viên thành công"
        );
      }

      setShowForm(false);

      setSelectedStudent(null);

      await loadStudents();
    } catch (error) {
      console.error(error);

      toast.error(
        error.response?.data?.message ||
          (selectedStudent
            ? "Cập nhật sinh viên thất bại"
            : "Thêm sinh viên thất bại")
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
      console.error(
        "LOGOUT ERROR:",
        error
      );

      /*
       * Dù logout API có lỗi
       * vẫn đưa user về Login.
       */
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
        <div className="size-8 animate-spin rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-blue-600"></div>

        <p>Đang tải dữ liệu...</p>
      </div>
    );
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div
      className="flex min-h-screen bg-[#f5f8ff] dark:bg-slate-950 font-sans text-[#203754] dark:text-slate-100"
    >
      {/* =================================================
          SIDEBAR
      ================================================= */}

      <StudentSidebar
        user={user}
        activePage={activePage}
        totalStudents={statistics.totalStudents}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onNavigate={(page) => {
          setSidebarOpen(false);

          if (page === "chat") {
            navigate("/chat");
            return;
          }
          if (!["dashboard", "students"].includes(page)) return;

          setActivePage(page);
          const params = new URLSearchParams(searchParams);
          params.set("view", page);
          params.delete("tab");
          if (page === "dashboard") {
            params.delete("search");
            params.delete("page");
            params.delete("pageSize");
          }
          setSearchParams(params, { replace: true });
        }}
        onOpenSettings={() =>
          openSettings("account")
        }
      />

      {/* =================================================
          MAIN
      ================================================= */}

      <main className={`min-h-screen min-w-0 flex-1 transition-[margin] duration-200 ${sidebarCollapsed ? "ml-[72px] max-[800px]:ml-0" : "ml-[250px] max-[1100px]:ml-[220px] max-[800px]:ml-0"}`}>
        {/* =================================================
            HEADER
        ================================================= */}

        <StudentHeader
          user={user}
          search={search}
          onSearchChange={handleSearchChange}
          showSearch={isAdmin && activePage !== "students" && activePage !== "settings"}
          darkMode={isDarkMode}
          onToggleDarkMode={toggleTheme}
          onOpenSettings={(tab = "account") =>
            openSettings(tab)
          }
          onLogout={handleLogout}
          onToggleSidebar={() =>
            setSidebarOpen(
              (open) => !open
            )
          }
          sidebarCollapsed={sidebarCollapsed}
          onToggleDesktopSidebar={toggleDesktopSidebar}
        />

        {/* =================================================
            PAGE CONTENT
        ================================================= */}

        <section className="px-4 py-6 sm:px-6 lg:px-[30px] lg:pt-7 lg:pb-10">
          {/* =================================================
              DASHBOARD
          ================================================= */}

          {activePage === "dashboard" && isAdmin && (
            <AdminOverview
              user={user}
              statistics={statistics}
              classStatistics={classStatistics}
              students={students}
              onOpenStudents={() => {
                setActivePage("students");
                const params = new URLSearchParams(searchParams);
                params.set("view", "students");
                setSearchParams(params, { replace: true });
              }}
            />
          )}

          {activePage === "dashboard" && !isAdmin && (
            <StudentPortalOverview
              user={user}
              onOpenChat={() => navigate("/chat")}
              onOpenSettings={() => openSettings("account")}
              onOpenCalls={() => navigate("/chat?calls=1")}
            />
          )}

          {activePage === "students" && isAdmin && (
            <StudentDashboard
              user={user}
              isAdmin={isAdmin}
              statistics={statistics}

              filteredCount={
                filteredStudents.length
              }

              students={students}

              filteredStudents={
                filteredStudents
              }

              paginatedStudents={
                paginatedStudents
              }

              currentPage={visiblePage}

              pageCount={pageCount}

              pageSize={pageSize}

              firstStudentIndex={
                firstStudentIndex
              }

              lastStudentIndex={
                lastStudentIndex
              }

              onPageChange={
                handlePageChange
              }

              onPageSizeChange={
                handlePageSizeChange
              }

              error={error}
              loading={loading}
              onRetry={loadStudents}
              search={search}

              onSearchChange={
                handleSearchChange
              }

              onAdd={handleAdd}

              onEdit={handleEdit}

              onDelete={handleDelete}

              classStatistics={
                classStatistics
              }

              showForm={showForm}

              selectedStudent={
                selectedStudent
              }

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
                const params = new URLSearchParams(searchParams);
                params.set("view", "settings");
                params.set("tab", tab);
                setSearchParams(params);

                if (tab === "sessions") {
                  loadSessions();
                }
              }}

              activeSessions={
                sessions.filter(
                  (session) =>
                    !session.revoked_at
                ).length
              }

              loading={sessionsLoading}

              onRefresh={loadSessions}
            >
              <div className="min-w-0">
                {/* =========================================
                    ACCOUNT
                ========================================= */}

                {settingsTab === "account" && (
                  <AccountSettings
                    user={user}
                    form={accountForm}
                    onChange={setAccountForm}
                    onSubmit={
                      handleUpdateAccount
                    }
                    saving={accountSaving}
                    message={
                      accountMessage
                    }
                    onAvatarUpdated={updateUser}
                  />
                )}

                {settingsTab === "notifications" && <NotificationSettings />}

                {settingsTab === "appearance" && <AppearanceSettings />}
                {settingsTab === "language" && <LanguageSettings />}

                {/* =========================================
                    SECURITY
                ========================================= */}

                {settingsTab === "security" && (
                  <SecuritySettings
                    onOpenSessions={() =>
                      setSettingsTab(
                        "sessions"
                      )
                    }
                  />
                )}

                {/* =========================================
                    SESSIONS
                ========================================= */}

                {settingsTab === "sessions" && (
                  <SessionSettings
                    sessions={sessions}
                    loading={sessionsLoading}
                    error={sessionsError}
                    currentSessionId={
                      currentSessionId
                    }
                    onRefresh={
                      loadSessions
                    }
                    onRevoke={
                      handleRevokeSession
                    }
                    onRevokeOthers={
                      handleRevokeOtherSessions
                    }
                    formatDate={
                      formatSessionDate
                    }
                    getDeviceIcon={
                      getSessionIcon
                    }
                  />
                )}

                {/* =========================================
                    CHANGE PASSWORD
                ========================================= */}

                {settingsTab === "password" && (
                  <PasswordSettings
                    form={passwordForm}
                    onChange={
                      setPasswordForm
                    }
                    onSubmit={
                      handleChangePassword
                    }
                    saving={
                      passwordSaving
                    }
                    message={
                      passwordMessage
                    }
                    error={
                      passwordError
                    }
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
