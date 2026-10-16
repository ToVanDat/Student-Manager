# Báo cáo audit chức năng — 2026-10-16

Phạm vi: nhánh `feature/chat-1to1-complete`. Audit dựa trên cây repository, route/controller/service/repository, API frontend, component React, SQL migrations, test files và GitHub Actions workflow.

**Giới hạn xác minh:** Không có kết nối trực tiếp tới PostgreSQL/DBeaver local hoặc phiên trình duyệt đang chạy của người dùng. Vì vậy, báo cáo phân biệt rõ những gì code thể hiện với những gì chưa thể xác nhận khi chạy thực tế.

## 1. Tổng quan

| Khu vực | Trạng thái code | Nhận xét |
|---|---|---|
| Authentication, session, profile | Đã có | Có login/register/refresh/logout, reset password, profile/avatar, change password và session endpoints. Cần tiếp tục kiểm thử integration và quyền từng API. |
| Quản lý sinh viên | CRUD backend đã có | Có list, get-by-id, create, update, delete; mutation yêu cầu admin và có validation. |
| Tìm kiếm/phân trang/sắp xếp sinh viên | Backend có; frontend từng nối sai | Đã sửa ở lượt này để frontend dùng page/pageSize và totalCount từ API; bổ sung điều khiển sắp xếp. |
| Hồ sơ sinh viên chi tiết | API có, UI trước đó thiếu | Đã thêm dialog lấy dữ liệu thật qua endpoint hiện có. Phạm vi hiện chỉ gồm trường mà API trả về. |
| Khoa/lớp/môn học/học kỳ/đăng ký học phần | API CRUD đã có | Các mục điều hướng quản trị trên frontend hiện hiển thị nội dung giới thiệu module, chưa phải giao diện CRUD đầy đủ. |
| Dashboard quản trị | Có thống kê | API tính tổng sinh viên, lớp và giới tính; thống kê theo lớp lấy từ database. Cần xác minh nghiệp vụ thống kê và tải thực tế. |
| Cổng sinh viên | Có giao diện khung | Một số thẻ lịch học/điểm và hoạt động đang là nội dung placeholder, chưa kết nối với API dữ liệu học tập tương ứng. |
| User Theme / Chat Theme | Code API, UI, migration đã có | Không thể xác nhận database local đã chạy migration. Nếu thiếu cột/bảng, endpoint theme sẽ không lưu được. |
| i18n tiếng Việt/tiếng Anh | Có | Hai file locale tồn tại; cần tiếp tục rà các giao diện quản trị đang dùng chuỗi hard-code. |
| Chat 1-1, Group Chat, file, reactions, calls, notification/push | Nhiều API và service đã có | Có route/controller/service/repository và các migration tính năng. Chưa xem đây là nghiệm thu end-to-end chỉ dựa trên sự tồn tại của code. |
| Import/export, bulk actions, trạng thái sinh viên, audit log | Chưa thấy triển khai hoàn chỉnh | Chưa thấy bộ xử lý import/export, thao tác hàng loạt, workflow trạng thái hoặc audit-log service/table tương ứng trong cây file đã kiểm tra. |

## 2. Những điểm đã sửa trong lượt này

### 2.1 Phân trang server-side

Trước khi sửa, `useStudents` nhận tham số phân trang nhưng `Students.jsx` không truyền page/pageSize; frontend còn tính pageCount từ số bản ghi trong trang hiện tại và cắt dữ liệu lần thứ hai. Điều này làm phân trang có thể dừng ở trang đầu hoặc hiển thị sai.

Đã sửa:
- Truyền page, pageSize, sortBy, sortOrder vào `useStudents`.
- Tính pageCount và số thứ tự bản ghi từ `pagination.totalCount`.
- Dùng trực tiếp danh sách đã phân trang từ API, không cắt lần hai.
- Giữ trang 1 khi thay đổi từ khóa hoặc cách sắp xếp.

### 2.2 Sắp xếp danh sách

Backend đã cho phép sắp xếp theo các trường nằm trong allowlist. Frontend chưa có điều khiển sắp xếp tương ứng. Đã thêm:
- Click tiêu đề cột để đổi tăng dần/giảm dần.
- Điều khiển sắp xếp trên màn hình nhỏ.
- Lưu trạng thái sort trong URL để điều hướng trang không làm mất thứ tự.

### 2.3 Hồ sơ sinh viên chi tiết

API `GET /api/students/:id` và hàm `getStudentById` đã tồn tại. Đã bổ sung dialog tải dữ liệu qua API, có loading/error/retry, hỗ trợ đóng bằng Escape và nút chuyển sang chỉnh sửa. Dialog chỉ hiển thị các trường hiện có: mã, họ tên, email, ngày sinh, giới tính và lớp; không giả lập bảng điểm/tài liệu chưa có API.

### 2.4 Theme

Đã có `user_preferences.sql`, `conversation_management.sql` và `theme_preferences_migration.sql`. Migration theme yêu cầu các bảng nền đã tồn tại:
1. `user_preferences.sql` tạo bảng tuỳ chọn tài khoản.
2. `conversation_management.sql` tạo `conversation_user_settings`.
3. `theme_preferences_migration.sql` bổ sung/chuẩn hoá `theme` và `chat_theme`.

Không thể chạy migration hộ người dùng vì phiên audit không kết nối được database local. Cần xác minh kết quả SQL trong DBeaver và kiểm thử API thực tế.

## 3. Thiếu sót và rủi ro còn lại

### Ưu tiên cao

1. **Giao diện quản lý đào tạo:** `Students.jsx` hiện dùng màn giới thiệu cho các mục lớp, khoa, môn học, học kỳ, đăng ký học phần, kết quả, tài khoản và phân quyền. Backend có CRUD cho một số module nhưng frontend chưa cung cấp danh sách/form/thao tác quản trị tương ứng.
2. **Bộ lọc danh sách sinh viên:** hiện API tìm kiếm theo mã, họ tên, email, mã lớp và tên lớp; chưa thấy filter server-side riêng theo lớp/khoa/giới tính. Không thấy workflow trạng thái sinh viên trong code truy vấn/validation.
3. **Cổng sinh viên:** lịch học và điểm đang hiển thị placeholder; chưa tìm thấy API/service chuyên cho thời khóa biểu hoặc bảng điểm. Không nên hiển thị nội dung này như dữ liệu thực.
4. **Import/export và thao tác hàng loạt:** chưa thấy API, UI hoặc kiểm thử tương ứng.
5. **Lịch sử hoạt động/audit log:** `StudentActivity` hiện có trạng thái không có dữ liệu; chưa thấy schema/service để ghi lại ai đã tạo/sửa/xóa/chuyển lớp.
6. **Theme trong môi trường local:** phải xác nhận migration đã chạy đúng database. Nếu bảng/cột chưa tồn tại, User Theme hoặc Chat Theme có thể rollback khi lưu thất bại.

### Rủi ro về migration

- `conversation_management.sql` và `chat_safety_features.sql` cùng khai báo `blocked_users` và `conversation_reports`, nhưng định nghĩa `conversation_reports.reason` và các index khác nhau. Trên database mới, kết quả có thể phụ thuộc file được chạy trước.
- `group_chat_presence.sql` và `group_presence.sql` có phần thay đổi schema trùng lặp, nhưng tên index không hoàn toàn giống nhau.
- Thư mục SQL hiện chủ yếu chứa migration mở rộng; chưa tìm thấy một migration nền thống nhất cho toàn bộ các bảng học vụ. Cần lập thứ tự chạy migration rõ ràng trước khi dựng database mới.

Không tự động đổi hoặc xoá schema cũ trong lượt audit này vì chưa thể kiểm tra dữ liệu thực tế và thứ tự migration đã chạy tại môi trường người dùng.

### Quyền truy cập và bảo mật

- Các API thay đổi sinh viên có `requireRole('admin')`; các API CRUD học vụ chính cũng có kiểm tra role ở backend.
- `GET /api/students` và `GET /api/students/:id` cho phép người dùng đã xác thực truy cập dữ liệu sinh viên, bao gồm email/ngày sinh. Cần xác nhận nghiệp vụ rằng role không phải admin có được phép xem toàn bộ dữ liệu này hay chỉ hồ sơ của mình; chưa tự đổi vì chưa có quy tắc liên kết tài khoản–sinh viên được xác nhận.
- Authentication middleware kiểm tra JWT, Redis token, session bị thu hồi và trạng thái tài khoản hiện tại; tuy vậy vẫn cần kiểm thử integration với Redis/PostgreSQL và ma trận quyền đầy đủ.

## 4. Kiểm thử hiện có

Workflow `.github/workflows/api-tests.yml` hiện chạy:
- `npm test` trong backend.
- `npm run build` trong frontend.

Các test backend hiện là unit tests cho validation, upload policy, file optimization, notification policy, call validation và group authorization. Chưa thấy frontend component tests hoặc integration tests dùng database. Workflow chưa chạy script `npm run lint` của frontend.

Trong lượt này, GitHub Actions cho commit sửa bảng sinh viên đã báo **API unit tests: success; frontend build: success**. Điều này xác nhận test/build tự động, không thay thế kiểm thử thực tế với PostgreSQL local và trình duyệt.

## 5. Thứ tự triển khai đề xuất

1. Đối chiếu database local với migrations và xác nhận Theme hoạt động end-to-end.
2. Hoàn thiện bộ lọc sinh viên phía server (lớp/khoa/giới tính trong phạm vi schema hiện có) và bổ sung test.
3. Xây giao diện CRUD thực cho các module học vụ dựa trên API đang tồn tại; không tạo API/bảng trùng.
4. Thực hiện import/export và thao tác hàng loạt sau khi xác nhận định dạng dữ liệu, quyền và giới hạn upload.
5. Thiết kế trạng thái sinh viên, lịch sử thay đổi, tài liệu và ghi chú sau khi xác nhận schema/nghiệp vụ.
6. Tăng test coverage integration/API permission và thêm frontend tests; chạy lint trong CI.
