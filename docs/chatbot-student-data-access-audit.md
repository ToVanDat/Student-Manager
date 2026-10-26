# Chatbot student-data access audit

**Branch:** `feature/chat-1to1-complete`  
**Audit basis:** tracked repository source and the read-only SQL audit script.  
**Database status:** not executed against the developer's local database; runtime schema and data are therefore unverified.

## Current access boundary

- `router/chatbotRouter.js` requires `authMiddleware` for both chat and history deletion.
- `chatbotController.js` passes `req.user.sub`, `req.user.sessionId`, and `req.user.role` to the service. The role is populated by `authMiddleware` from the current user record, rather than accepted from the request body.
- `chatbotService.js::loadAcademicContext` loads public catalog fields from subjects, semesters, departments, and classes.
- The non-admin path does not query `students` or `enrollments` and does not expose individual grades or student records.
- The admin path adds aggregate counts only. It does not select student rows or grade details.
- Chat history is scoped to the authenticated user and session in Redis.

## Account-to-student identity finding

The tracked `repository/studentRepository.js` reads and writes student records using student identifiers and class relationships. Its current CRUD queries do not demonstrate a trusted `users.id -> students.id` ownership relationship.

The repository includes `sql/student_schema_readonly_audit.sql`. It is intentionally read-only and inspects:

1. Columns and constraints for `users`, `students`, and `enrollments`.
2. Foreign keys among those tables.
3. Student-code and email duplicate candidates.
4. The count of email overlaps between users and students.

An email overlap is only a candidate match. It must not be used as an authorization relationship or as an implicit account-linking mechanism.

**Conclusion:** source code currently provides no verified ownership mapping that would justify chatbot access to personal grades, schedules, enrollment records, or student profile data. The actual database may contain additional constraints or columns, but that must be established by running the read-only audit on the intended local database and reviewing its output.

## Gate before enabling personal student data

Do not add personal-data queries until all of the following are reviewed and approved:

- A stable, unique account-to-student relationship is confirmed in the actual database.
- The relationship is established through an explicit, verified account-linking flow; email similarity alone is insufficient.
- The backend resolves the student record from the authenticated user identity on the server. The client and LLM must never supply an authoritative `student_id`.
- Every query is constrained by the resolved student ownership key, including grades, schedules, enrollments, and attachments.
- Tests prove that one user cannot read another student's records, including by changing IDs, prompt injection, or replaying another session.
- Admin aggregate access remains separate from student self-service access.
- The LLM receives only the minimum authorized records and is never allowed to generate or execute SQL.

## Safe next step

Run `students_managerment-api/sql/student_schema_readonly_audit.sql` against the intended local database in read-only review mode. Inspect the results before proposing any schema change. Do not apply a migration, backfill, merge accounts, or infer identity from matching emails as part of this audit.
