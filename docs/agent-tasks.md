# ProView — Task packages cho agent triển khai

Trạng thái cập nhật 08/10/2026: các gói nghiệp vụ đã tích hợp và có kiểm thử chạy thật. Xem [trạng thái từng gói và phần còn thiếu](implementation-status.md), [bằng chứng kiểm thử](evidence/implementation-verification.md). Danh sách dưới đây giữ acceptance gốc; không tự động đánh dấu DONE cho mọi assertion chưa kiểm chứng.

**Chỉ một agent thực hiện tuần tự**, theo yêu cầu hiện tại của người dùng. Không tiếp tục các subagent cũ. ID là gói công việc, không phải agent đang chạy; handoff chung trong `implementation-status.md` thay các báo cáo module lặp lại. Tài liệu A03 đã có được giữ nguyên để đối chiếu.

Đọc [implementation plan](implementation-plan.md), [domain decisions](domain-decisions.md), [frontend adaptation](frontend-adaptation-plan.md), [requirements matrix](requirements-matrix.md) trước khi bắt đầu.

## Quy ước chung

- Mỗi task tạo handoff tại `docs/tasks/<ID>.md`: baseline, scope, status, changed paths, contract delta, commands + results, evidence, blockers.
- Trạng thái: `PLANNED → READY → IN_PROGRESS → IN_REVIEW → DONE`; có `BLOCKED` với dependency rõ. Không dùng DONE cho phần chỉ dựng UI/mock hoặc test chưa chạy.
- Schema/migration chỉ A03 sửa; lockfile/root build/Compose chỉ A02 sửa; root web shell/API/query conventions chỉ F00 sửa. Module owner gửi change request cho owner chung.
- Feature API và UI đi qua backend thật. Unit/component test có fixture/mock là hợp lệ; integration/E2E không mock core nghiệp vụ.
- Module owner viết unit + integration tests liên quan ngay trong task; Q00 kiểm tra độc lập, không phải người duy nhất viết test.
- Mọi task mutation phải nêu policy, state/deadline guard, transactional audit, notification intent, concurrency/idempotency phù hợp.
- Các đường dẫn là **ownership dự kiến**; A00/A02/F00 chốt cây thật rồi cập nhật trước khi phân công. Không tạo duplicate module chỉ vì tên khác nhau.

## Bảng điều phối

| ID  | Gói công việc                                       | Dependency bắt buộc để hoàn tất              | Gate                  |
| --- | --------------------------------------------------- | -------------------------------------------- | --------------------- |
| A00 | Kiến trúc/contract/điều phối                        | Hai đặc tả                                   | G0; review xuyên suốt |
| A01 | OpenReview baseline/provenance                      | A00 phạm vi                                  | G0–G1                 |
| A02 | Workspace, toolchain, Docker, CI nền                | A00                                          | G1                    |
| A03 | Schema, migrations, seed foundation                 | A00, A02                                     | G1                    |
| A04 | Auth, session, policy, privacy framework            | A03, audit port A13a                         | G1                    |
| A05 | Course/offering/roster/groups/rubrics               | A03, A04, A13a                               | G2                    |
| A06 | Storage, submission versioning, workflow            | A05                                          | G2                    |
| A07 | Reviewer assignment và COI                          | A06                                          | G3                    |
| A08 | Structured review, anonymity, correction            | A07                                          | G3                    |
| A09 | Rebuttal, discussion, review release                | A08                                          | G4                    |
| A10 | Similarity/COOPY thủ công                           | A06                                          | G4                    |
| A11 | Grading và evidence workspace                       | A08, A09, A10                                | G4                    |
| A12 | Archive/reference permissions                       | A11, A05 historical membership               | G5                    |
| A13 | Audit, notification, scheduler                      | A03; a: nền tảng, b: tất cả events           | G1/G5                 |
| A14 | Admin APIs, profile/password integration            | A04, A13a                                    | G5                    |
| F00 | Web shell, auth/client/adapters                     | A01, A02, A04; contract A00                  | G1                    |
| F01 | Course/project/setup UI                             | F00, A05                                     | G2                    |
| F02 | Submission/PDF/assignment/review UI                 | F00, A06–A08; discussion A09                 | G2/G3                 |
| F03 | Rebuttal và grading panels                          | F02 shell, A09, A11                          | G4                    |
| F04 | Dashboards/similarity/archive/notifications/profile | F00 và API tương ứng A05/A07/A10/A12/A13/A14 | G5                    |
| F05 | Admin UI                                            | F00, A14; catalog contract A05               | G5                    |
| Q00 | Test harness, security và E2E theo lát cắt          | A00; infrastructure A02/A03 khi chạy         | G0–G5                 |
| Q01 | Clean-room acceptance, production local, handoff    | Toàn bộ feature đã tích hợp                  | G6                    |

## A00 — Kiến trúc, hợp đồng và tích hợp

**Owner:** integrator. **Paths:** `docs/adr/`, các tài liệu kiến trúc/permission/workflow/API, contract review; quyền điều phối shared changes.

**Công việc:**

1. Hợp nhất 59 mục, đánh dấu override Next.js, giữ backend riêng, scope không deploy.
2. Chốt quyết định trong domain-decisions thành ADR và bảng state transition đầy đủ cả skip/reopen.
3. Định nghĩa OpenAPI public contract, naming, errors, pagination, DTO theo audience, capability flags, route inventory và permission matrix.
4. Chốt quan hệ exact version/rubric/membership history, điểm số, archive eligibility, role creation/admin rights.
5. Chốt owner mỗi file chung; quy trình schema delta và dependency update; review toàn bộ integration diffs.
6. Theo dõi requirements matrix và evidence, không xác nhận PASS thay worker khi chưa kiểm chứng.

**Acceptance:** mọi workflow/page có actor, API và test target; không còn khác nhau giữa domain/frontend về version/state/quyền. A01 có quyết định pin/retain license. Contract thay đổi về sau có version và người chịu trách nhiệm.

## A01 — Baseline OpenReview và license/provenance

**Dependency:** A00 xác nhận hướng dẫn xuất. **Paths:** import lần đầu `apps/web/`, `docs/openreview-adaptation.md`, `docs/upstream-openreview.md`, các notices thuộc frontend.

**Công việc:**

1. Clone official repository vào vị trí khảo sát phù hợp, ghi URL, commit SHA thật, version/tag nếu có, license, ngày lấy.
2. Đọc README/LICENSE/CONTRIBUTING/package/routing/components/forms/forum/profile/auth/client/test setup; kiểm tra thêm source so với khảo sát planning.
3. Cài bằng lockfile/package manager upstream để giữ baseline; chạy lint/unit/build khả thi. E2E cần backend OpenReview thì ghi limitation riêng, không khởi tạo hệ thống OpenReview để trở thành dependency ProView.
4. Lưu command/log baseline. Chuyển source nguyên gốc đã pin vào `apps/web`, không mang nested `.git` hoặc secrets; giữ provenance và license headers.
5. Lập inventory `reuse/refactor/replace/isolate`, mapping conceptual domain, active route allowlist; ghi nơi clone và cách tái tạo baseline.
6. Phối hợp A02 chuyển pnpm workspace sau baseline, F00 tiếp nhận root/frontend ownership. Giữ corresponding source và modification record phù hợp license; không tự gắn license độc quyền cho code dẫn xuất.

**Acceptance:** SHA kiểm chứng được, upstream snapshot tái tạo được; actual reused paths được ghi nhận; có kết quả checks thật kể cả failure/limitation. Chưa được gọi đây là frontend hoàn tất.

## A02 — Monorepo, toolchain, infrastructure, CI

**Dependency:** A00. **Paths:** root workspace/package/lockfile, `packages/config`, Dockerfiles/Compose/infra, `.env.example`, CI config, scripts wiring.

**Công việc:**

1. Pin phiên bản Node/pnpm và dependency tương thích, stable, kiểm tra tài liệu chính thức tại thời điểm implement. Không cập nhật upstream hàng loạt chỉ để dùng số version lớn nhất.
2. Khởi tạo NestJS skeleton, kết nối `apps/web` của A01; chỉ một workspace và lockfile cho ProView.
3. ESLint/Prettier/TypeScript strict cho code mới; giữ JS upstream có kiểm soát. Chốt cách xử lý oxlint/oxfmt upstream bằng ADR, không để scripts đánh lừa kết quả.
4. Compose dev dependencies PostgreSQL + MinIO; production profile API/Next/proxy cùng origin, healthchecks, volumes, non-root container nếu khả thi.
5. Env validation fail-fast, example không secret thật; structured logs/request IDs, health/liveness/readiness. Tách `APP_ENV` khỏi `NODE_ENV` để production build local có thể dùng demo data được opt-in, trong khi production thật cấm seed demo; cookie Secure được kiểm qua local HTTPS proxy hoặc HTTP override chỉ cho local.
6. Wiring scripts lint/typecheck/test/build/migrate/seed/offline; CI dùng service DB/storage và artifact logs.

**Acceptance:** dependency containers healthy; workspace install từ lockfile; backend và frontend baseline build độc lập; secrets không vào image/client bundle. Compose và root config chỉ một owner chỉnh.

## A03 — Relational schema, migrations và seed foundation

**Dependency:** A00, A02. **Paths:** `apps/api/prisma/`, database infrastructure, seed/factories do owner quản lý.

**Công việc:**

1. Implement toàn bộ entity gốc và entity hỗ trợ đã duyệt: session, membership history, review correction, rebuttal responses, archive publication, outbox/reminder.
2. UUID/timestamps, FK, unique indexes, partial unique/check constraints cần SQL migration; index list/workload/unread/archive queries.
3. Ràng buộc cross-offering giữa stage/project/group/assignment, reviewer target XOR, exact version và rubric linkage; soft delete/retention phù hợp dữ liệu học thuật.
4. Tạo initial migration, validate trên PostgreSQL thật; không dùng SQLite thay thế. Migration sau này theo thứ tự qua owner.
5. Seed nền users/course/stages/rubric; khi feature hoàn tất bổ sung full demo fixture qua change request, không để từng agent có một script seed xung đột.
6. Seed cuối: admin + instructor, 8–12 students, nhiều groups, offering active và historical closed/archived và cohort sau, PDF thật, reviews/rebuttal, similarity pending/completed, published grade/reference.

**Acceptance:** migrate empty DB rồi seed pass; seed dev re-run không nhân bản dữ liệu; constraint tests bắt invalid state; production không tự seed demo. Lịch sử version/group không bị cascade xóa ngoài ý muốn.

## A04 — Authentication, policy và privacy foundation

**Dependency:** A03; port audit đã chốt, A13a để tích hợp. **Paths:** `modules/auth/`, policy/guards/presenters common, users identity/query primitives; self password service.

**Công việc:**

1. Login username/email + Argon2id hoặc bcrypt, access token ngắn hạn, refresh cookie HttpOnly/Secure/SameSite đúng môi trường.
2. Hash refresh tokens, rotation/reuse detection, session family revoke, logout; password reset/change/deactivate tích hợp revocation. Không log token/password.
3. CORS allowlist, CSRF bảo vệ các cookie-auth endpoints, origin check, login rate limit, secure headers, sanitized errors, DTO validation.
4. Policy context nạp user + memberships + resource ownership; default deny và explicit public endpoints. Admin không mặc định bypass academic workflow.
5. Presenter/serializer interface cho author/reviewer/instructor/admin/reference viewer, DTO allowlist; audit read không mở cho student.
6. Cung cấp `me`, change password, session behavior cho F00; A14 chỉ dùng service qua API nội bộ ổn định.

**Acceptance:** real auth integration với cookie attributes, rotation/replay/logout/deactivation/password reset; cross-offering instructor/student denied; account switch không giữ cache quyền cũ; public endpoints được liệt kê rõ.

## A05 — Course, offering, roster, group, rubric

**Dependency:** A03/A04/A13a. **Paths:** `modules/courses`, `offerings`, `groups`, `rubrics` và tests của chúng.

**Công việc:**

1. Catalog query/service phục vụ admin, offering CRUD/status và instructor memberships; mặc định tạo Proposal/Final Report với config đúng prompt.
2. Copy configuration: clone stages/rubrics/settings nhưng yêu cầu ngày mới/validate lịch; không copy users/groups/submissions/reviews/grades/publication.
3. Roster add/remove khi editable; CSV schema documented, preview validation, atomic import/recheck, row summary. Mặc định dùng existing user accounts.
4. Group create/rename/membership và project title/description; unique active membership, freeze từ submit đầu tiên, historical membership vẫn truy vấn được.
5. Stage generic, sequence unique, deadline/order/timezone/config combination validation; additional stage không đổi schema.
6. Rubric criteria CRUD/order/weights/score ranges/recommendation configuration; khóa rubric đã dùng, clone để sửa.

**Acceptance:** instructor wrong offering bị chặn; copy chỉ config; duplicate student group kể cả concurrent bị chặn DB; CSV malformed/duplicate/unknown/cross-role có summary; stage/rubric invalid bị reject; lifecycle changes có audit.

## A06 — Storage, versioned PDF và submission workflow

**Dependency:** A05; Storage DTO A00. **Paths:** `modules/storage`, `submissions`, workflow service và file endpoints.

**Công việc:**

1. Local và S3-compatible adapter, kiểm thử MinIO, private storage, random key, configured file limit.
2. Validate presence/size/extension/MIME và nội dung PDF signature; checksum SHA-256 server-side, filename sanitized cho display/header.
3. Upload immutable version; tăng version trong transaction, metadata uploader/time/change note; temp upload cleanup khi lỗi.
4. Submit chọn exact version, tách latest draft/submitted; kiểm tra actor/deadline/state; resubmit trước review-lock theo ADR.
5. State machine có transition explicit, skip review/rebuttal theo config, reopen command có audit và invalidate evidence đúng rule. Các service khác sử dụng command, không tự sửa status.
6. Authorized viewer/download/history access; range response, content type/disposition/cache phù hợp; không lấy quyền chỉ bằng storage key hoặc ID biết trước.

**Acceptance:** v1/v2 khác object, checksum và history; review-pinned version không đổi theo current; wrong file/type/size rejected; direct API/file/range access trái phép bị chặn; concurrent upload, failed DB/storage và double-submit không hỏng dữ liệu.

## A07 — Deterministic assignment và COI

**Dependency:** A06/A05, policy A04. **Paths:** `modules/reviewer-assignments`, `conflicts`, algorithm unit tests.

**Công việc:**

1. API manual assignment, auto preview/apply, workload, reasons, version pin, reviewer group hoặc instructor target đúng offering.
2. Domain engine input/output thuần, stable ordering/tie-break; hard constraints không self/shared member/duplicate/cross-offering/ineligible/approved COI.
3. Spike thuật toán trước implementation chính: tìm nghiệm đủ không reciprocal khi khả thi; chỉ dùng reciprocal khi không có nghiệm tránh được; cân workload trong tập nghiệm hợp lệ. Không dùng greedy một lượt làm chứng minh.
4. Candidate lựa chọn: deterministic constraint search/optimization chạy local, có giới hạn pilot và benchmark; license dependency kiểm tra nếu dùng solver. Timeout trả chưa thể kết luận, không gọi là infeasible. Small exhaustive oracle xác nhận các trường hợp nhỏ.
5. Preview có demand/capacity/unmet demand/exclusions và snapshot revision; apply revalidate/transaction/idempotent, không overwrite submitted assignments.
6. COI declaration/decision; pending pause review, rejected restore prior allowed state; approved revoke quyền ngay, giữ lịch sử, tạo replacement lineage manual/auto chỉ fill missing slot.

**Acceptance:** các graph 0/1/2/3/many groups, uneven capacity, preexisting/manual assignments, k quá lớn, COI-heavy, reciprocal alternative, permutation input, repeatability; stale preview/double apply/COI decision race; revoked reviewer không đọc file được.

## A08 — Structured review và anonymity

**Dependency:** A07; release contract A00. **Paths:** `modules/reviews`, review presenters, review-specific policy extensions.

**Công việc:**

1. Một review draft cộng tác cho một assignment; instructor review và group review; scores/comments/strengths/weaknesses/overall/recommendation.
2. Validate criterion đầy đủ và cùng pinned rubric; exact submissionVersion; save draft with revision, submitter thực được lưu.
3. Submit immutable, deadline và COI/state guard; instructor-authorized correction bằng revision và lý do, giữ bản trước.
4. DTO audience projection từ backend; reviewer alias không dùng real ID, author không thấy draft/unreleased review hoặc raw reviewer relationships.
5. Author review retrieval dùng release state; instructor nhìn identity thật; reviewer không nhìn review draft của reviewer khác.
6. Event/audit/notification payload đi qua schema tối thiểu; phối hợp A13 chống leak và A09 review-specific discussion.

**Acceptance:** members cùng nhóm cộng tác được nhưng stale save 409; other groups không edit; submitted read-only; criterion mismatch rejected; identity test NAMED/ANONYMOUS bao phủ detail/list/nested/meta/notification; instructor vẫn thấy thật.

## A09 — Review release, rebuttal và discussion

**Dependency:** A08/A06. **Paths:** `modules/rebuttals`, `discussions`, release coordinator theo extension point của workflow.

**Công việc:**

1. Release reviews/open rebuttal khi đủ review hoặc instructor audited close; không silently hoàn tất review thiếu. Deadline và config phải hợp lệ.
2. Một group rebuttal mỗi submission, general response + optional per-review responses; reviewId cùng submission, author attribution và timestamps.
3. Draft/save/finalize, optimistic lock; deadline chặn tại API, instructor reopen có reason và new effective deadline/override record.
4. Discussion scope submission/review, actor access theo context; review thread chỉ author/instructor/assigned reviewer được phép, không general messenger.
5. Sanitize render XSS, length/rate bounds hợp lý; anonymous reviewer message không lộ author ID/profile/email qua nested metadata.

**Acceptance:** unreleased reviews/closed deadline/wrong group/wrong review rejected; finalize khóa edit; reopen hoạt động sau deadline cũ; staff không mất identity view; discussion access và sanitizer tests; audit + in-app notification thật.

## A10 — Manual textual similarity / COOPY

**Dependency:** A06/A13a. **Paths:** `modules/similarity-checks`, result attachment integration.

**Công việc:**

1. Submit stage requireSimilarityCheck tạo PENDING idempotently cho version đã submit.
2. Instructor/admin policy → obtain exact report → mark SUBMITTED_EXTERNALLY → nhập percent nullable/date/notes/result PDF → COMPLETED.
3. FAILED/WAIVED yêu cầu reason; retry/reopen theo state table, giữ audit lịch sử; percent chỉ 0–100.
4. Result PDF dùng cùng validation/private storage/access framework; không gọi COOPY API, không tự tính similarity hoặc plagiarism.
5. Query queue/filter/status phục vụ F04 và grade evidence; new final version không dùng kết quả cũ làm current eligibility.

**Acceptance:** full manual flow; wrong actor/version/percent/state denied; completed/waived/failed audit; upload lỗi rollback/cleanup; check v1 không thỏa v2; đúng wording textual similarity.

## A11 — Grading và consolidated evidence

**Dependency:** A08/A09/A10. Có thể code scoring/draft theo contract trước A09, nhưng phải tích hợp toàn bộ trước DONE. **Paths:** `modules/grades`, grading workspace read service.

**Công việc:**

1. Endpoint evidence gộp project/version history/reviews/real identities/rebuttal/discussion/similarity/rubric được kiểm quyền.
2. Draft grade + criterion scores + feedback, revision locking; score normalization/precision/overall override theo ADR.
3. Publish transactional, correct version, required similarity terminal; grade publish audit + notification + student projection.
4. Student chỉ đọc published grade của own group; draft không xuất field ở response khác, dashboard/cache/archive.
5. Republish correction nếu cho phép cần command lý do/audit; không làm thay đổi silently bản published. Finalize workflow bằng command A06.

**Acceptance:** draft never visible, publish updates real student API; grade tied rubric/version, invalid range rejected; stale save/double publish; similarity FAILED/PENDING/wrong version chặn; no peer-average auto grade; consolidated evidence không thiếu hoặc chéo submission.

## A12 — Archive, historical profile và reference publication

**Dependency:** A11/A05/A06. **Paths:** `modules/archive`, historical-project query endpoint.

**Công việc:**

1. Query completed Project qua dữ liệu thật, không copy project/file thành archive database.
2. Own history dựa historical membership; offering closed/archived vẫn giữ quyền own history theo policy.
3. Explicit approve/revoke version reference; later offering cùng Course eligible; dùng dates/period order, không so text semester.
4. Course/semester/title filters; student search chỉ instructor/admin có quyền; pagination/rate/limit tránh unrestricted bulk download.
5. Minimal reference DTO; không tự mở review/rebuttal/grade/private attachments. Inline mặc định, download chỉ khi allowDownload, check quyền ngay khi file request.
6. Revoke làm mất quyền reference và invalidates cached authorization. Nếu dùng signed URL phải TTL ngắn và test giới hạn revocation; ưu tiên stream backend cho rule revoke ngay.

**Acceptance:** old owner, later cohort same course, wrong course, same/earlier cohort, nonapproved, revoked, inactive account; direct private submission endpoint vẫn denied dù reference được xem; approved exact PDF; không bulk zip endpoint cho student.

## A13 — Audit, notifications, reminders

**Dependency:** A03. **Paths:** `modules/audit`, `notifications`, outbox/scheduler common; schema delta qua A03.

**A13a — làm sớm:** transactional AuditWriter/EventRecorder, event schema registry, append-only normal APIs, in-app notification list/unread/read/read-all theo recipient, worker retry/dedup/locking, test fixed clock. A04/domain task dùng writer trong transaction; không cần Redis.

**A13b — tích hợp theo feature:** assignment, deadline approaching, COI decision, review submitted, rebuttal window, final submission, similarity result, grade published; resource-aware recipients và payload an toàn. Job restart không mất event; reminder tính ngày/đổi deadline không gửi sai hoặc lặp.

**Acceptance:** notification xuất phát từ real mutation; rollback không có ghost event; worker retry không duplicate; student không đọc notification/audit người khác; body/URL/meta không lộ anonymous reviewer; audit có actor/action/entity/time/reason phù hợp, không token/password.

## A14 — Admin APIs và profile integration

**Dependency:** A04/A13a. **Paths:** `modules/users/admin-*`, `modules/admin` nếu thực sự cần, admin audit read endpoints; catalog dùng service A05, không viết domain catalog trùng.

**Công việc:**

1. Search/list/create/edit accounts, activate/deactivate, explicit global role changes, administrative reset password.
2. Sử dụng password/session service A04, audit privileged actions; không impersonation ngầm, không public signup.
3. Admin catalog CRUD qua Course service, deletion guard khi có offerings/history; instructor catalog read/create offering tách permission.
4. Read-only audit filters actor/action/entity/date + pagination; role guard.
5. Profile get/update name/email theo policy, change password theo A04; own historical projects từ A12. Email uniqueness và reauthentication nếu ADR yêu cầu.

**Acceptance:** non-admin denied trên mọi admin endpoint; reset/deactivation revoke sessions; user/course có history không bị cascade mất dữ liệu; role change có audit; self profile không sửa role bằng mass assignment.

## F00 — Next.js shell, ProView auth, API và view models

**Dependency:** A01/A02/A04; A00 contracts. **Paths:** `apps/web/app` root layout/navigation/login, providers, `lib/api/client*`, shared DTO/adapters/view-model conventions, theme.

**Công việc:**

1. Chuyển auth/middleware SSR/client khỏi OpenReview; role-aware navigation đúng prompt, branding/title/metadata ProView.
2. One API client, auth refresh single-flight, safe error handling, no secret client bundle; query key/cache lifecycle.
3. DTO → pure view-model adapters, discriminated named/anonymous reviewer props; không tạo Notes/Invitations giả.
4. Dọn root analytics/Turnstile/external assets/runtime API calls; local fonts/assets, no-store private SSR/RSC; route allowlist.
5. Chốt style tokens Navy/accent, reusable leaf components đã audit, accessibility/layout, no wholesale TS/CSS rewrite.
6. Shell state loading/error/empty/forbidden, account expiry/logout; register central feature slots để feature agents không sửa cùng root.

**Acceptance:** ProView account login/refresh/logout works; no OpenReview account/redirect/runtime request; role nav correct, direct conference routes unreachable; account switch/cache/SSR privacy; build succeeds với API endpoint documented.

## F01 — Course, setup, roster, groups và project workspace

**Dependency:** F00/A05. **Paths:** `features/courses`, `offerings`, `groups`, `rubrics`, các route tương ứng sau F00 đăng ký.

**Công việc:** course/offering list/detail; create/copy configuration; stage timeline/deadline/anonymity/review count settings; rubric editor; roster CSV preview/summary; group management/title/description; student project members/status.

**Acceptance:** E2E instructor setup thật, CSV row errors và atomic result rõ; student không thấy/manage controls trái quyền; invalid stage/rubric errors mapped; group freeze lý do rõ; keyboard/tablet/mobile usable; không dùng conference terminology.

## F02 — Central submission workspace, assignments và review

**Dependency:** F00, A06–A08; discussion A09. **Paths:** `features/submissions`, `features/reviews`, `features/assignments`, `features/conflicts`; central workspace container do F02 sở hữu.

**F02a:** submission title/group/course/stage, selected/current/reviewed versions rõ ràng, PDF authorized viewer, upload revision/progress/change note, history, submit confirmation, workflow/deadlines. Mở slot review/rebuttal/grade với API capability; không hardcode tab visible theo global role.

**F02b:** reviewer dashboard + form scores/comments/strengths/weaknesses/recommendation, draft save/resume/final immutable state, COI declaration. Instructor manual/auto preview/apply/workload/COI approve/reject/reassign/review monitoring. Review cards và scoped discussion dùng DTO an toàn.

**Acceptance:** upload v1/v2/submit v2 thật; reviewer luôn biết version đang review; no stale autosave loss, 409 có UI xử lý; same page author anonymous/instructor named đúng; insufficient assignment capacity hiển thị nguyên nhân; keyboard/mobile PDF form usability. F03 chỉ cung cấp panels, không sửa container tự do.

## F03 — Rebuttal và consolidated grading panels

**Dependency:** F02 central slot, A09/A11. **Paths:** `features/rebuttals`, `features/grading`.

**Công việc:** author rebuttal general/per-review response, save/finalize/deadline/reopen state; instructor evidence workspace gồm review identities/scores, rebuttal/discussion/similarity/version history; grade draft/criterion/feedback/publish confirmation; published student grade presentation.

**Acceptance:** real review → rebuttal → grading E2E; expired/finalized không edit; draft grade không nhận từ API student; exact version labels; missing similarity eligibility chặn publish với lý do từ API; stale revision không silently overwrite.

## F04 — Secondary workflows và dashboards

**Dependency:** F00, API tương ứng; không chờ A12 cho phần similarity/dashboard. **Paths:** `features/dashboards`, `similarity`, `archive`, `notifications`, `profile`.

**F04a:** student/instructor dashboard aggregates; similarity queue và manual staff result form/result PDF; notification unread/list/read; profile/name/email/password. Widgets dùng real queries, không counts giả.

**F04b:** own project history; approved reference archive course/semester/title search, staff student search; instructor approve/revoke/download policy; later cohort inline PDF. Tích hợp dashboard archive/grade khi A12 đã ready.

**Acceptance:** pending/completed similarity đều có thật; UI nói textual similarity, không gọi COOPY hay kết luận plagiarism; notification workflow có tác dụng; archive policies E2E; secret review/grade không xuất qua dashboard/query cache.

## F05 — Administrator UI

**Dependency:** F00/A14/catalog A05. **Paths:** `features/admin`, routes admin do F00 đăng ký.

**Công việc:** dashboard admin, user search/create/edit/activate/deactivate/reset/role; catalog CRUD; audit actor/action/entity/date filters, pagination; confirmation cho privileged/destructive action.

**Acceptance:** admin flow dùng API thật; non-admin direct route/API denied; error/final action feedback đúng; reset không hiển thị secret trong audit/log; không thêm impersonation; responsive và keyboard.

## Q00 — Continuous QA, security và test harness

**Dependency:** bắt đầu ở A00; chạy sau infrastructure/schema tương ứng. **Paths:** `tests/e2e`, shared test-support, security/contract/offline test scripts; CI wiring phối hợp A02.

**Công việc:**

1. Dựng PostgreSQL/MinIO isolated test environment, deterministic factories/fixed clock, authenticated role fixtures; worker concurrency không dùng chung mutable user/DB ngoài chủ ý.
2. API contract drift + serializer/policy negative tests; test theo matrix actor × resource × state × time.
3. Playwright theo E01–E10 và adaptation checks trong requirements matrix. Có real API + storage; API/DOM assertion chống leak, không chỉ screenshot.
4. Anonymity gồm API/list/nested, notifications/discussion/archive, SSR/RSC/HTML/meta/query cache, file access; instructor view phải còn thật.
5. Algorithm tests với brute-force oracle nhỏ; lifecycle deadlines/concurrency/rollback; account/session security/XSS/CSRF/upload controls.
6. Browser route interception + server/container egress restriction; test không Internet khi local stack sẵn; asset/PDF worker/font local.
7. Keyboard/focus/labels/contrast/desktop/tablet/mobile trọng yếu. Không xây hàng trăm snapshot test vô nghĩa.

**Acceptance:** CI test failures có trace/log/request IDs, không secret; independent negative tests thật sự fail nếu bỏ guard/projection; coverage mapping không có requirement chỉ được đánh dấu bằng lời; upstream TestCafe baseline tách khỏi ProView Playwright.

## Q01 — Nghiệm thu clean-room và handoff production local

**Dependency:** all feature owners DONE, Q00 suites ready. **Paths:** final README/deployment/testing/evidence docs; sửa lỗi code do owner tương ứng thực hiện.

**Công việc:**

1. Chạy từ checkout sạch và DB/volumes test mới: env example → install → migrate → seed; test không cần sửa source. Giữ dữ liệu người dùng nếu có, chỉ reset môi trường test được nhận diện.
2. Format check, lint, typecheck, backend unit/integration, frontend tests, Playwright full; sửa lỗi rồi chạy lại phần liên quan và full gate cuối.
3. Build API/Next và production Docker; chạy production local, smoke login all roles và full lifecycle. E2E final dùng production builds (`NODE_ENV=production`, `APP_ENV=local/test`); demo seed cần opt-in, không được suy ra môi trường dữ liệu chỉ từ NODE_ENV.
4. Offline/egress assertions; kiểm source route/brand/OpenReview runtime dependency với attribution allowlist; license/provenance/source readiness.
5. Kiểm docs bắt buộc, env/operator secrets, backup DB + storage/restore, migrations, HTTPS/reverse proxy, exact future deployment commands.
6. Handoff demo accounts/dev password warning đúng chỗ, commands đã chạy, logs/results, unresolved external production values. Không deploy hosting.

**Acceptance:** toàn G6 PASS với evidence thực; không core TODO/mock, không skip required checks để tạo green. Nếu môi trường thiếu capability thì báo chính xác check chưa chạy và việc cần làm, không ghi hoàn thành toàn hệ thống.
