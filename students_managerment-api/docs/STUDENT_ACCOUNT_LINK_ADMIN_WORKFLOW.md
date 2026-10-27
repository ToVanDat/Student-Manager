# Student account linking: admin verification workflow

## Purpose
Link one active `users.role = 'user'` account to one `students` record only after a staff member verifies the person's identity against official institutional records.

The workflow deliberately does not infer identity from matching email addresses. The browser never supplies an authoritative actor ID: the API uses the authenticated administrator from the access token.

## Migration order
1. Back up the target PostgreSQL database and confirm the active database/schema.
2. Run `student_schema_readonly_audit.sql` and review the output. This file contains SELECT statements only.
3. If the `permissions` and `role_permissions` tables do not exist, review/apply `role_permissions_migration.sql` first.
4. Review and apply `student_account_link_schema_migration.sql` if `student_account_links` does not already exist. It creates the one-to-one mapping table only.
5. Review and apply `student_account_link_admin_workflow_migration.sql`. It adds verification metadata, an append-only application audit table and the `students.link_accounts` permission.
5. Verify both migrations using information_schema and pg_constraint queries before deploying the API.

Neither migration auto-links accounts, copies student data, or deletes existing records. Do not run the base migration again if the table already exists: it intentionally stops for manual inspection.

## Admin procedure
1. Open Account management → Identity verification.
2. Search for the active user account and the unlinked student record.
3. Verify identity outside the application using the institution's approved process.
4. Select both records, confirm the identity statement, and optionally enter a short operational note. Do not store ID numbers, scans, passwords, OTPs, or sensitive documents in the note.
5. Create the link. The API locks both records, checks the account role/status, enforces one-to-one uniqueness and records the authenticated administrator.
6. If a correction is required, unlink with a reason. The mapping is removed (portal access is revoked) while an audit event is retained. Neither user nor student record is deleted.

## API
- `GET /api/students/account-links?search=`: linked rows, eligible unlinked accounts, eligible unlinked students, and recent audit events.
- `POST /api/students/account-links`: body `{ userId, studentId, confirmIdentity: true, verificationNote? }`.
- `DELETE /api/students/account-links/:userId`: body `{ reason }`, reason length 10–500.

All three endpoints require an authenticated admin and `students.link_accounts`. The regular-user portal remains `GET /api/students/me` and derives ownership solely from `req.user.id`.

## Operational boundary
The application records the administrator's attestation; it does not independently validate government identity documents or perform eKYC. If the institution requires stronger assurance, integrate an approved identity provider or registrar workflow before relaxing this manual-verification requirement.
