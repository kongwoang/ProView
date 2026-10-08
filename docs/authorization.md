# Authorization and privacy

Every private API route requires a valid access JWT and an active, unrevoked database session. Refresh secrets are stored only as hashes. Refresh rotation tracks a family; reusing a rotated token revokes the family. Logout, password change, administrative password reset and account deactivation invalidate affected sessions. Browser access tokens are held in memory; refresh tokens use HttpOnly, SameSite cookies with Secure mandatory for deployed production.

| Actor/context                     | Granted capability                                                                                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Administrator                     | User administration, course catalog, audit search, staff similarity/archive administration and explicitly audited file access                                          |
| Active offering instructor        | Offering setup, roster/groups/stages/rubrics, submission workflow, assignment/COI decisions, real reviewer identities, grading and archive approvals for that offering |
| Current author group member       | Own project versions, submission actions within the input window, released reviews, rebuttal/discussion and published grades                                           |
| Historical version author         | Authored exact version PDF and corresponding published evidence; former membership does not grant later evidence                                                       |
| Active reviewer assignment member | Assigned exact version/rubric and its review workflow; suspended/cancelled/replaced assignments lose access                                                            |
| Later same-course student         | Only expressly approved reports from earlier closed/archived offerings; download additionally requires publication permission                                          |

Membership uses active intervals rather than deleting history. Group membership freezes after initial submission. Instructor commands use offering membership, rather than the account's global role. An administrator is not silently treated as a course reviewer or grader.

Anonymous-to-authors mode uses aliases in author-facing review/discussion projections. Real reviewer user/group identifiers, submitter metadata, private COI reasons, draft content and storage keys are omitted from unauthorized DTOs. Staff grading context is a separate endpoint. Identity resolution is done on the backend; hiding a name in React does not establish privacy.

Private object requests generally return404 when the actor has no relationship to the object. Explicit staff-only command surfaces return403. Invalid payloads return400 or422, stale revision/closed workflow returns409, unauthenticated sessions return401. Validation forbids extra fields, so client attempts to change profile role or evidence storage keys fail.

Mutating auth-cookie routes require an exact configured frontend Origin. Other mutation routes require an Authorization bearer token; the refresh cookie alone grants no domain capability. Logs include request IDs, method/path/status and elapsed time, never passwords, JWTs, cookies or raw database connection errors. Audit metadata records reasons and evidence identifiers without authentication secrets.

Evidence: database integrity tests; actual API acceptance suites under `scripts`; browser session/privacy tests. Consult `testing.md` for commands and the release evidence file for executed results and limits.
