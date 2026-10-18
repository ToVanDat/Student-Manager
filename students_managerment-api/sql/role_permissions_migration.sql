-- Additive, rerunnable migration. Does not alter or delete existing tables/data.
BEGIN;

CREATE TABLE IF NOT EXISTS permissions (
    permission_key TEXT PRIMARY KEY,
    module_key TEXT NOT NULL,
    label_vi TEXT NOT NULL,
    label_en TEXT NOT NULL,
    description_vi TEXT NOT NULL DEFAULT '',
    description_en TEXT NOT NULL DEFAULT '',
    is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    permission_key TEXT NOT NULL REFERENCES permissions(permission_key) ON DELETE CASCADE,
    allowed BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (role, permission_key)
);

INSERT INTO permissions (permission_key, module_key, label_vi, label_en, description_vi, description_en, is_sensitive)
VALUES
 ('students.view','students','Xem sinh viên','View students','Xem hồ sơ sinh viên và dữ liệu cá nhân.','View student records and personal data.',TRUE),
 ('students.manage','students','Quản lý sinh viên','Manage students','Thêm, sửa và xóa hồ sơ sinh viên.','Create, update and delete student records.',TRUE),
 ('classes.view','classes','Xem lớp học','View classes','Xem danh sách và thông tin lớp học.','View classes and class details.',FALSE),
 ('classes.manage','classes','Quản lý lớp học','Manage classes','Thêm, sửa và xóa lớp học.','Create, update and delete classes.',FALSE),
 ('departments.view','departments','Xem khoa','View departments','Xem danh sách khoa.','View departments.',FALSE),
 ('departments.manage','departments','Quản lý khoa','Manage departments','Thêm, sửa và xóa khoa.','Create, update and delete departments.',FALSE),
 ('subjects.view','subjects','Xem môn học','View subjects','Xem danh sách môn học.','View subjects.',FALSE),
 ('subjects.manage','subjects','Quản lý môn học','Manage subjects','Thêm, sửa và xóa môn học.','Create, update and delete subjects.',FALSE),
 ('semesters.view','semesters','Xem học kỳ','View semesters','Xem danh sách học kỳ.','View semesters.',FALSE),
 ('semesters.manage','semesters','Quản lý học kỳ','Manage semesters','Thêm, sửa và xóa học kỳ.','Create, update and delete semesters.',FALSE),
 ('enrollments.view','enrollments','Xem đăng ký và điểm','View enrollments','Xem đăng ký học và điểm; chỉ quản trị viên được phép.','View enrollments and grades; admin-only.',TRUE),
 ('enrollments.manage','enrollments','Quản lý đăng ký và điểm','Manage enrollments','Thêm, sửa và xóa đăng ký học/điểm; chỉ quản trị viên được phép.','Create, update and delete enrollments/grades; admin-only.',TRUE),
 ('accounts.manage','accounts','Quản lý tài khoản','Manage accounts','Đổi vai trò và trạng thái tài khoản.','Change account roles and active status.',TRUE),
 ('permissions.manage','permissions','Quản lý phân quyền','Manage permissions','Xem và cập nhật quyền theo vai trò.','View and update role permissions.',TRUE)
ON CONFLICT (permission_key) DO UPDATE SET
 module_key = EXCLUDED.module_key,
 label_vi = EXCLUDED.label_vi,
 label_en = EXCLUDED.label_en,
 description_vi = EXCLUDED.description_vi,
 description_en = EXCLUDED.description_en,
 is_sensitive = EXCLUDED.is_sensitive;

-- Preserve current behavior by seeding grants consistent with existing routes.
-- Standard users may view the general catalogs; sensitive academic records and
-- all mutation/admin features remain admin-only regardless of grant settings.
INSERT INTO role_permissions (role, permission_key, allowed)
SELECT 'admin', permission_key, TRUE FROM permissions
ON CONFLICT (role, permission_key) DO NOTHING;

INSERT INTO role_permissions (role, permission_key, allowed)
SELECT 'user', permission_key, permission_key IN
 ('classes.view','departments.view','subjects.view','semesters.view')
FROM permissions
ON CONFLICT (role, permission_key) DO NOTHING;

COMMIT;
