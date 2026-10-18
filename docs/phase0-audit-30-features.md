# Phase 0 — Audit 30 tính năng mở rộng

- Repository: `ToVanDat/Student-Manager`
- Branch: `feature/chat-1to1-complete`
- Audit snapshot: 2026-10-18
- Phạm vi: đọc cây repository, package manifests, route/controller/service/repository/middleware, các component quản trị liên quan, SQL migrations, tests và CI workflow.
- **Giới hạn quan trọng:** phiên audit này không kết nối được PostgreSQL/DBeaver local hoặc trình duyệt đang chạy của người dùng. Trạng thái dưới đây là đánh giá dựa trên code trong branch, không phải nghiệm thu runtime. Không sửa logic ứng dụng, không tạo bảng, không chạy migration và không xóa dữ liệu trong Phase 0.

## 1. Kiến trúc đã xác minh trong repository

### Frontend
- React 19 + Vite 8, React Router 7, Tailwind CSS 4.
- Trang quản trị/sinh viên tập trung ở `src/pages/students/Students.jsx`; route chính gồm `/students`, `/chat`, `/login`.
- Các component quản trị đã có: `ClassManagement.jsx`, `CatalogManagement.jsx`, `EnrollmentManagement.jsx`, `UserManagement.jsx`, `PermissionsOverview.jsx`.
- API client tập trung tại `src/api/client.js`; API sinh viên tại `src/api/studentApi.js`.
- Có i18n, theme context, thông báo toast và giao diện chat.
- Frontend package có script `build` và `lint`; không thấy script test frontend trong manifest.

### Backend
- Node.js CommonJS + Express 5, PostgreSQL qua `pg`, Redis, JWT, Socket.IO.
- `src/server.js` khởi tạo Redis, Socket.IO và HTTP server; `src/app.js` đăng ký route và middleware chung.
- Các tầng đang dùng gồm `router/`, `controller/`, `service/`, `repository/`, `middleware/`, `src/config/`.
- Route chính: `/api/students`, `/api/classes`, `/api/departments`, `/api/enrollments`, `/api/semesters`, `/api/subjects`, `/api/auth`, `/api/auth/sessions`, `/api/users`, `/api/permissions`, `/api/conversations`, `/api/messages`, `/api/calls`, `/api/notifications`.
- Backend test command là `node --test`; hiện có unit tests cho validation, upload/file optimization, notification policy, call validation, group authorization, permission service, role middleware và user service.

## 2. Schema và dữ liệu

- Code sinh viên truy vấn `students` join `classes`, dùng các trường như `student_code`, `name`, `email`, `date_of_birth`, `gender`, `class_id`, `class_code`, `class_name`.
- Route học vụ hiện có CRUD cho classes, departments, subjects, semesters và enrollments; enrollment có trường điểm như `midterm_score`, `final_score`, `total_score` trong UI.
- Có các SQL migration bổ sung cho `role_permissions`, `user_preferences`, chat, notifications, calls và theme. Đây không phải bản schema nền đầy đủ cho toàn bộ database.
- Migration quyền định nghĩa `permissions` và `role_permissions`; role được giới hạn ở `admin` và `user`. Không có căn cứ để thêm role mới trong Phase 0.
- Cần đối chiếu database local với migration đã áp dụng trước bất kỳ thay đổi schema nào. Repository không cho biết chắc chắn migration nào đã chạy ở môi trường người dùng.
- Rủi ro đã thấy trong audit trước: `conversation_management.sql` và `chat_safety_features.sql` có phần khai báo bảng trùng nhau với khác biệt định nghĩa; `group_chat_presence.sql` và `group_presence.sql` có phần thay đổi schema trùng lặp. Cần rà thứ tự/khả năng chạy lại trước khi dựng mới hoặc chỉnh migration.

## 3. Authentication và authorization

- Middleware xác thực JWT, kiểm tra trạng thái Redis/session và tài khoản theo code hiện có.
- `requireRole('admin')` được dùng riêng với `requirePermission(...)`; permission grant không tự nâng user thành admin đối với các route có role guard.
- Route sinh viên hiện yêu cầu đăng nhập, role admin và permission `students.view` hoặc `students.manage`; đây là biện pháp bảo vệ dữ liệu cá nhân rõ ràng trong code.
- Classes/departments/subjects/semesters có permission đọc và role admin + permission cho thao tác ghi. Enrollment route được giới hạn admin do dữ liệu có điểm.
- User/permission management có service/controller; API cập nhật tài khoản giữ role `admin/user`, có kiểm tra không tự sửa tài khoản và không vô hiệu hóa/hạ quyền admin cuối cùng.
- Chưa xác minh end-to-end với PostgreSQL/Redis, ma trận quyền trên mọi route, hay quan hệ tài khoản với hồ sơ sinh viên. Không được giả định rằng user đã được liên kết với một bản ghi sinh viên cụ thể.

## 4. Bảng trạng thái 30 tính năng

Quy ước: **Có trong code** = đã thấy phần triển khai; không đồng nghĩa đã nghiệm thu runtime. **Một phần** = có phần cốt lõi nhưng thiếu phạm vi nêu trong yêu cầu. **Chưa thấy** = không tìm thấy bằng chứng triển khai hoàn chỉnh trong các module đã audit. **Cần xác minh** = phụ thuộc schema/nghiệp vụ/runtime chưa có bằng chứng.

| # | Tính năng | Trạng thái Phase 0 | Bằng chứng / phần còn thiếu |
|---:|---|---|---|
| 1 | Danh sách sinh viên nâng cao | Một phần | Có bảng, trạng thái tải/lỗi/rỗng và dữ liệu API; cần kiểm thử tải lớn và UX end-to-end. |
| 2 | Tìm kiếm sinh viên | Có trong code, cần kiểm thử | Tìm theo mã, tên, email và thông tin lớp bằng parameterized query/ILIKE; chưa thấy tìm kiếm không dấu. |
| 3 | Lọc, sắp xếp, phân trang | Có trong code, một phần | Có server-side page/pageSize, allowlist sort, lọc lớp/giới tính; chưa có filter khoa/trạng thái vì chưa xác minh mô hình trạng thái. |
| 4 | Thêm sinh viên | Có trong code, cần kiểm thử | Form/API và validation; backend xử lý lỗi trùng qua constraint PostgreSQL. Cần test tích hợp chống gửi lặp/đồng thời. |
| 5 | Chỉnh sửa sinh viên | Có trong code, cần kiểm thử | PATCH + validation partial; cần kiểm thử tích hợp và quyền từng trường. |
| 6 | Chi tiết hồ sơ sinh viên | Có trong code, phạm vi giới hạn | API chi tiết và dialog đã có; chỉ hiển thị trường API cung cấp, chưa thấy lịch sử/tài liệu/bảng điểm gắn trong hồ sơ. |
| 7 | Quản lý trạng thái sinh viên | Chưa thấy đầy đủ / cần xác minh | Chưa có bằng chứng rõ về vòng đời trạng thái như đang học, bảo lưu, tốt nghiệp; không tự thêm cột/enum. |
| 8 | Chuyển lớp sinh viên | Một phần / cần xác minh | Cập nhật `class_id` có thể nằm trong sửa hồ sơ; chưa thấy workflow chuyển lớp riêng và audit trail. |
| 9 | Thao tác hàng loạt | Chưa thấy | Chưa tìm thấy API/UI bulk action, xác nhận và kết quả theo từng bản ghi. |
| 10 | Phát hiện dữ liệu thiếu/trùng | Chưa thấy đầy đủ | Có xử lý lỗi unique khi tạo/sửa; chưa thấy màn hình rà soát bản ghi thiếu/trùng để admin kiểm tra. |
| 11 | Quản lý khoa | Có CRUD trong code | Backend CRUD và `CatalogManagement` có cấu hình khoa; cần kiểm thử các quan hệ đang được tham chiếu. |
| 12 | Quản lý lớp | Có CRUD trong code | Backend CRUD và `ClassManagement`; cần kiểm thử trùng mã, khoa hợp lệ và xóa lớp có sinh viên. |
| 13 | Quản lý môn học | Có CRUD trong code | Backend CRUD và `CatalogManagement`; cần kiểm tra validation mã môn học/credits và ràng buộc enrollment. |
| 14 | Quản lý học kỳ | Có CRUD trong code, một phần | Backend CRUD và UI; cần xác minh quy tắc ngày bắt đầu/kết thúc, trùng học kỳ và khóa dữ liệu lịch sử. |
| 15 | Đăng ký học phần | Có CRUD trong code, cần kiểm thử | API và `EnrollmentManagement` có tạo/sửa/xóa; cần audit transaction, đăng ký trùng, race condition và constraint thật. |
| 16 | Điểm/kết quả học tập | Một phần | Enrollment UI có các trường điểm; cần xác minh thang điểm, tính điểm tổng, lịch sử chỉnh sửa và quyền. Không thấy workflow kết quả riêng đã được nghiệm thu. |
| 17 | Dashboard Admin | Có trong code, cần kiểm thử | Có component dashboard và thống kê backend; cần kiểm tra mọi số liệu dùng dữ liệu thật, trạng thái lỗi và tải lớn. |
| 18 | Biểu đồ/thống kê | Một phần | Có thống kê tổng quan/theo lớp; chưa đủ bằng chứng về các biểu đồ theo khoa/trạng thái/thời gian và đồng bộ filter. |
| 19 | Xuất báo cáo CSV/Excel | Chưa thấy | Chưa tìm thấy luồng export hoàn chỉnh; cần xác định format, quyền, filter và chống CSV formula injection trước khi triển khai. |
| 20 | Quản lý tài khoản | Có trong code, cần kiểm thử | Có danh sách/tìm kiếm và cập nhật role/trạng thái; cần kiểm tra pagination, khóa tài khoản và toàn bộ quyền backend. |
| 21 | Phân quyền Admin/User | Có trong code, cần kiểm thử | Có migration, service, middleware và UI quản lý quyền; quyền trên mỗi route và migration ở DB local vẫn cần integration test. |
| 22 | Hồ sơ và quyền truy cập | Một phần / cần xác minh | Có auth/profile endpoints; route sinh viên hiện admin-only. Chưa thấy liên kết tài khoản–sinh viên để xác thực quyền xem hồ sơ của chính mình. |
| 23 | Upload/tải/xóa tệp theo quyền | Một phần | Có upload policy và chat attachment endpoints có xác thực; chưa thấy module tài liệu hồ sơ sinh viên đầy đủ. |
| 24 | Nhật ký hoạt động | Chưa thấy đầy đủ | `StudentActivity` hiển thị empty state; chưa thấy bằng chứng service/table audit log ghi actor, action, timestamp, target. |
| 25 | Lịch sử thay đổi hồ sơ | Chưa thấy | Chưa thấy cơ chế lưu before/after có bằng chứng; không thể tạo lịch sử hồi tố cho dữ liệu cũ. |
| 26 | Thông báo trong hệ thống | Có một phần đáng kể | Có notification center, push subscription/preferences và delivery service; cần kiểm thử DB/runtime, unread/read và chống trùng notification. |
| 27 | Quy trình phê duyệt | Chưa thấy | Chưa tìm thấy workflow trạng thái chờ duyệt/chấp thuận/từ chối; chỉ triển khai khi nghiệp vụ yêu cầu. |
| 28 | Cải thiện UI/UX | Một phần | Có nhiều component quản trị và trạng thái tải/lỗi; cần rà tính nhất quán, responsive, accessibility và các màn chưa có thao tác đầy đủ. |
| 29 | Tối ưu hiệu năng | Một phần | Có phân trang server-side, allowlist sort, debounce ở một số giao diện và `sharp`/file optimization; chưa có benchmark, slow query audit hay xác minh N+1 toàn hệ thống. |
| 30 | Bảo mật, test, vận hành | Một phần | Có security headers, CORS allowlist, validation, role/permission middleware và unit tests. Cần integration tests, frontend tests, lint trong CI, kiểm tra CSRF/XSS, backup/restore và cấu hình production. |

## 5. Vấn đề ưu tiên theo bằng chứng

### P0 — Xác minh trước khi mở rộng
1. Xác minh database local và các migration đã áp dụng; không chạy lại migration mù quáng.
2. Bổ sung/kiểm tra integration tests cho authorization, đặc biệt dữ liệu sinh viên, điểm, tài khoản và tệp.
3. Rà các migration có định nghĩa trùng/khác nhau trước khi dựng DB mới.
4. Xác nhận yêu cầu nghiệp vụ cho trạng thái sinh viên, quyền user xem hồ sơ, và quy tắc điểm.

### P1 — Nâng cấp chức năng nghiệp vụ
1. Bổ sung filter khoa chỉ khi quan hệ hiện có được xác minh; thêm test cho tìm kiếm, sort, pagination, class/gender filter.
2. Hoàn thiện thao tác chuyển lớp có kiểm tra nghiệp vụ; cân nhắc bulk actions sau khi xác định thao tác được phép.
3. Rà CRUD học vụ, unique constraints, transaction và lỗi tham chiếu.
4. Xây export CSV/Excel an toàn và màn hình phát hiện dữ liệu thiếu/trùng nếu được yêu cầu.

### P2 — Hoàn thiện vận hành/UX
1. Bổ sung lịch sử hoạt động/thay đổi với chính sách lưu trữ và quyền xem được xác định.
2. Hoàn thiện dashboard/chart, responsive/accessibility, frontend tests và lint trong CI.
3. Benchmark truy vấn và kiểm tra backup/restore trước khi tối ưu dựa trên giả định.

## 6. File/module dự kiến theo phase

- **Phase 1 (features 1–8):** `students_management-frontend/src/pages/students/Students.jsx`, `src/components/students/StudentTable.jsx`, `StudentForm.jsx`, `StudentDetailsDialog.jsx` (nếu còn thiếu), `src/hooks/useStudents.js`, `src/api/studentApi.js`; backend `router/studentRouter.js`, `controller/student_controller.js`, `service/studentService.js`, `repository/studentRepository.js`, `middleware/studentValidation.js`; tests liên quan.
- **Phase 2 (9–10):** cùng module sinh viên, thêm service/API/UI riêng chỉ sau khi xác định hợp đồng bulk và quy tắc phát hiện duplicate; có thể cần audit schema trước.
- **Phase 3 (11–15):** `router/*Router.js`, `controller/*_controller.js`, `service/*Service.js`, `repository/*Repository.js` cho classes/departments/subjects/semesters/enrollments và các component `management/`.
- **Phase 4 (16–19):** enrollment/score modules và `AdminOverview.jsx`/chart components; export service mới chỉ khi format/permission được thống nhất.
- **Phase 5 (20–25):** `userRouter.js`, `permissionRouter.js`, auth middleware/role middleware/permission middleware, user/permission services, profile/file endpoints; audit log/history chỉ sau khi xác minh schema/chính sách.
- **Phase 6 (26–27):** tận dụng `notificationCenterService.js`, `notificationDeliveryService.js`, notification controllers/routes; approval workflow chưa nên tạo nếu chưa có nghiệp vụ cụ thể.
- **Phase 7 (28–30):** frontend component/style/context, backend validation/security middleware, `test/`, `.github/workflows/api-tests.yml`, frontend CI scripts và tài liệu vận hành.

## 7. Kiểm thử và giới hạn kết luận

- Đã đọc cấu hình test/backend package và frontend package; repository định nghĩa `npm test` cho backend, `npm run build` và `npm run lint` cho frontend.
- Báo cáo audit trước trong branch ghi nhận CI của commit khi đó thành công, nhưng điều này không chứng minh trạng thái database local hay runtime hiện tại.
- Trong lượt Phase 0 này **không chạy test/build, không kết nối DB, không sửa code ứng dụng và không chạy migration**. Vì vậy không tuyên bố các tính năng đã hoạt động end-to-end.

## 8. Đề xuất Phase 1

Bắt đầu bằng một vòng kiểm chứng hẹp, không sửa schema: đọc đầy đủ hook/table/form/validation/repository sinh viên và các test hiện có; sau đó chạy test/build trong môi trường checkout nếu có thể. Chỉ sửa các lỗi có bằng chứng ở features 1–8, mỗi thay đổi đi kèm test và báo cáo file/ảnh hưởng. Trước khi thêm trạng thái sinh viên, lịch sử chuyển lớp hoặc bulk action, phải xác nhận schema và nghiệp vụ thực tế.
