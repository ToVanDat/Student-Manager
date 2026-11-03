# Academic domain contract: timetable and GPA

## Status

This document is a design and verification contract, not an approved business policy or database migration.

- Timetable API: **blocked on inspection of the actual PostgreSQL schema and confirmation of scheduling semantics**.
- GPA: **blocked on confirmation of the institution's grading policy**.
- No production database objects or records are changed by this document.
- Do not treat the candidate models below as approved defaults.

## 1. Timetable: evidence required before implementation

### 1.1 Read-only database inventory

Run `students_managerment-api/sql/academic_timetable_readonly_audit.sql` against the intended database using a read-only account where possible. Save the output with the environment name and timestamp. The script reads PostgreSQL catalog metadata only; it does not return student rows or perform DDL/DML.

Review at least:

- Candidate relations and schemas for schedules, timetable entries, sessions, teaching assignments, rooms, classes, subjects/courses, semesters and enrollments.
- Column types, nullability and defaults.
- Primary/unique/foreign-key/check constraints and indexes.
- Whether schedule rows represent a recurring weekly pattern, a dated meeting, or both.
- Whether a student is associated to a class/cohort, an individual course enrollment, or both.

Do not infer a timetable from table names alone. Confirm foreign-key paths and application ownership rules.

### 1.2 Questions that must be answered

1. Is a meeting identified by a concrete date, or by weekday + effective date range?
2. Which timezone defines displayed meeting times? Is it campus-local time?
3. How are periods, start/end times, breaks and overnight boundaries represented?
4. Can a session be cancelled, moved, substituted, or assigned a different room/teacher?
5. Does a student's timetable derive from class membership, active enrollment, or an explicit student-session relation?
6. How are semester boundaries and overlapping schedules handled?
7. What is the source of truth for room, teacher and subject labels?
8. Which roles may view or manage schedules? Can students see only their own eligible sessions?

### 1.3 Minimum API behavior after schema confirmation

The API design should be derived from the discovered schema. A reasonable resource shape to evaluate (not a commitment to route names) is:

- Student self-service: current/selected-semester timetable, bounded date range, and session detail.
- Admin: filtered schedule lookup and separately authorized create/update/cancel operations, only if supported by the existing data model.
- Every student-facing query must derive the authenticated user ID from the verified session, resolve the verified student-account link, and scope the result to that student. Never accept a client-supplied student ID as authorization.
- Validate semester/date range, pagination and time boundaries. Parameterize all SQL.
- Return explicit empty/not-linked states; do not fabricate sessions or fall back to unscoped class data.
- Include cancellation/reschedule state and timezone semantics if the source schema supports them.

### 1.4 Timetable acceptance criteria

- Tests prove an unlinked account receives no timetable rows.
- Tests prove a linked student cannot read another student's sessions by changing URL/query parameters.
- Semester and date filters are parameterized and bounded.
- Cancelled/moved sessions follow the confirmed policy.
- DST/timezone and boundary behavior are tested where applicable.
- API output is checked against real schema fixtures, not guessed columns.
- No endpoint is marked complete until schema, authorization, integration tests and frontend contract agree.

## 2. GPA: policy decisions required

A GPA formula cannot be safely selected from score columns or frontend labels alone. Obtain the official academic regulation or written confirmation from the institution.

### 2.1 Confirm these policy dimensions

| Dimension | Decision required |
|---|---|
| Display scale | 4.0, 10.0, or another scale; precision and rounding rule |
| Grade conversion | Official score bands and grade-point mapping, including boundary inclusivity |
| Weight | Whether credits are the weighting unit; treatment of zero-credit courses |
| Included results | Passed, failed, incomplete, withdrawn, audited, exempted courses |
| Retakes | Replace prior grade, keep latest, keep highest, average attempts, or another rule |
| Repeated course credits | Whether credits count once or per attempt |
| Transfer/exempted courses | Include in GPA, exclude, or display separately |
| In-progress courses | Exclude until finalized or another policy |
| Scope | Semester GPA, cumulative GPA, program GPA, or multiple variants |
| Rounding | Round each course first or only the final weighted result |
| Invalid/missing data | Fail closed, omit with an explicit warning, or another official rule |

### 2.2 Candidate calculation only

If (and only if) the institution confirms credit-weighted grade points, the common mathematical form is:

`GPA = sum(grade_point_i * credit_i) / sum(credit_i)`

The difficult part is not this division; it is deciding which attempts/results enter each sum, how grades map to points, and when rounding occurs. Do not implement this formula as the product rule until the policy dimensions above are confirmed.

### 2.3 GPA implementation safeguards

- Centralize policy and calculation in a backend domain service; do not calculate authoritative GPA only in React.
- Keep raw scores, converted letter grades and grade points distinguishable.
- Use deterministic decimal arithmetic/appropriate numeric precision; avoid binary floating-point rounding surprises.
- Calculate semester and cumulative GPA from the same approved policy engine.
- Apply retake handling before aggregation.
- Exclude non-final results unless the policy explicitly says otherwise.
- Return the calculation scale, policy/version identifier, included-credit total and a transparent breakdown so results can be audited.
- Reject or explicitly report inconsistent grade/credit records; never silently invent missing values.

### 2.4 GPA acceptance criteria

- Unit tests cover every official grade-band boundary.
- Tests cover failed courses, retakes, repeated credits, withdrawals, incomplete grades, exemptions and zero-credit courses according to the approved policy.
- Tests cover exact rounding boundaries and empty/no-eligible-course cases.
- Semester and cumulative totals reconcile with hand-calculated official examples.
- Admin and student endpoints enforce role and student ownership independently of the calculation.

## 3. Evidence and handoff checklist

Before implementation is unblocked, attach or record:

- [ ] Read-only schema inventory output from the correct database/environment.
- [ ] Confirmation of timetable ownership path and recurring-vs-dated meeting semantics.
- [ ] Official GPA policy or written answers to section 2.1.
- [ ] Representative, anonymized academic fixtures that exercise the policy.
- [ ] Confirmation of which branch/environment is the implementation target.

Once those inputs exist, implement in this order:

1. Schema-aware repository/query layer and constraints (migration only after review).
2. Backend services and authorization-scoped routes.
3. Integration/unit tests for ownership, filtering and policy edge cases.
4. Frontend API integration and empty/loading/error states.
5. Reconciliation against approved sample records.

## 4. Explicit non-actions

This document does not:

- Create timetable tables, indexes, triggers or migrations.
- Add timetable routes or assume the existence of a schedule relation.
- Set a GPA scale, grade conversion table or retake policy.
- Run SQL against the user's local or production database.
- Deploy or merge any code.
