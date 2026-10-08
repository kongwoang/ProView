# ProView — Ma trận yêu cầu và bằng chứng nghiệm thu

Ngày lập kế hoạch: 2026-10-07.

**Cập nhật 2026-10-08:** ứng dụng đã được triển khai và đang được nghiệm thu tích hợp. Bảng bên dưới giữ tiêu chí gốc để đối chiếu; kết quả thực chạy nằm trong [implementation-verification.md](evidence/implementation-verification.md). Các tiêu chí chưa có bằng chứng không được tự động xem là hoàn thành.

Nguồn yêu cầu: prompt nền tảng, mục 1–40; prompt cập nhật OpenReview, mục 41–59. Mục 41–59 chỉ ghi đè phần frontend xung đột; backend và các yêu cầu nghiệp vụ, bảo mật, kiểm thử của mục 1–40 vẫn có hiệu lực. Sau khi duyệt kế hoạch, người dùng đã yêu cầu tạo GitHub repo, push và triển khai hệ thống; từ 2026-10-08 tiếp tục bằng một agent theo yêu cầu tiết kiệm chi phí.

## Cách sử dụng

- Nhóm công việc trong bảng là phạm vi trách nhiệm, không phải các agent được chạy đồng thời. ID công việc lấy từ [agent-tasks.md](agent-tasks.md); gate G0–G6 theo [implementation-plan.md](implementation-plan.md).
- Mỗi agent phải gắn PR/commit, test và tài liệu của mình với các mục yêu cầu liên quan. Một màn hình tồn tại không chứng minh quy tắc backend đã được thực thi.
- Feature agent chịu trách nhiệm unit/integration test của tính năng; nhóm QA sở hữu fixture dùng chung, E2E, kiểm thử xuyên module và đánh giá độ bao phủ. Không đợi hoàn thành UI mới bắt đầu QA.
- Chỉ đánh dấu một mục hoàn thành khi có bằng chứng chạy thật ở commit tích hợp. Mock dùng cho unit/component test không thay thế integration/E2E với PostgreSQL và storage thật.
- Bảng ghi “giữ nguyên” là giữ yêu cầu; “ghi đè một phần” là áp dụng thay đổi từ prompt sau; “bổ sung” là ràng buộc mới.
- `A00–A14`, `F00–F05`, `Q00–Q01` là ID task; `E01–E10` là E2E nghiệp vụ; `AD01–AD11` là assertions adaptation; `S01–S10` là nhóm security/integrity. Các namespace này không dùng thay thế nhau.

| Phạm vi trong ma trận | Task sở hữu implementation/bằng chứng |
| --- | --- |
| Kiến trúc, domain decisions, public contracts, tích hợp | A00; A03 schema/migrations; A04 policy conventions |
| Upstream, license/provenance, baseline | A01; F00 adaptation shell; Q01 final verification |
| Workspace, CI, Docker, env, operational readiness | A02; Q00 harness; Q01 clean-room/release local |
| Courses, offerings, membership, groups, stages, rubrics | A05; F01; A03 constraints/seed |
| Auth/session, authorization/privacy, admin/profile | A04; A14 admin/profile; F00 auth; F04 profile; F05 admin UI |
| Storage/submissions/workflow | A06; F02a; A03 constraints |
| Assignment/COI, structured reviews/anonymity | A07–A08; F02b; A09 release; Q00 independent checks |
| Rebuttal/discussion, similarity, grades | A09–A11; F02 discussion; F03 rebuttal/grading; F04 similarity |
| Archive và historical project access | A12; F04b; A03/A05 historical membership |
| Audit, notifications, deadline jobs | A13a foundation/A13b integration; từng domain owner phát event; F04 inbox |
| Student/instructor/admin dashboards | F04 student/instructor; F05 admin; backend aggregate query ownership do A00 chốt |
| Cross-module tests, coverage, final evidence/docs | Mỗi feature owner + Q00 continuous QA + Q01 G6; A00 review |

## Bao phủ đủ 59 mục

| Mục | Hiệu lực | Deliverable và nhóm phụ trách | Bằng chứng nghiệm thu cần có |
| --- | --- | --- | --- |
| 01 — Mục đích hệ thống | Giữ nguyên | Kiến trúc/nghiệp vụ: phạm vi course project từ offering đến archive, ba nhóm người dùng | E01–E10 tạo thành vòng đời hoàn chỉnh; kiểm tra navigation không có chức năng LMS ngoài phạm vi |
| 02 — Technology stack | Ghi đè phần frontend bởi 41, 45 | Nền tảng: pnpm workspace, NestJS, PostgreSQL/Prisma, REST/OpenAPI, storage adapter, Docker, tests; frontend React/Next.js dựa OpenReview, TypeScript cho code mới | Lockfile và runtime được pin sau khảo sát; lệnh install/lint/typecheck/test/build chạy thật; không chuyển sang Vite/React Router chỉ để theo prompt cũ |
| 03 — Repository và module | Giữ nguyên, điều chỉnh cấu trúc frontend theo upstream | Nền tảng: `apps/web`, `apps/api`, packages chia sẻ/config, docs; module backend theo domain | Kiểm tra dependency graph, imports, module ownership; domain logic nằm backend; build cả workspace |
| 04 — Domain model | Giữ nguyên | Domain/database: các entity tối thiểu, UUID, timestamp, FK, unique/check/index | Migration từ DB rỗng; integration test chứng minh constraint; tài liệu ER/entity và index; không expose Prisma object trực tiếp |
| 05 — Course/Offering | Giữ nguyên | Courses: Course khác CourseOffering; DRAFT/ACTIVE/CLOSED/ARCHIVED; copy cấu hình | E01; integration copy không mang theo student, group, submission, review, grade; kiểm thử status transition và quyền |
| 06 — Membership/roster | Giữ nguyên | Courses/identity: INSTRUCTOR/STUDENT theo offering; thêm/xóa khi được phép; CSV validation và summary | E01; malformed/duplicate/nonexistent user CSV; quyền instructor khác offering; không có public enrollment; quyết định import atomic/partial được ghi rõ |
| 07 — Project groups | Giữ nguyên | Groups: CRUD hợp lệ, membership, title/description, một Project mỗi group; lịch sử membership được bảo toàn | E01; hai request thêm cùng student vào hai group không phá invariant; khóa chỉnh sửa theo policy; profile/archive không mất quan hệ lịch sử |
| 08 — Submission stages | Giữ nguyên | Stages: cấu hình generic, Proposal/Final Report mặc định, deadlines và rubric | E01; tạo stage thứ ba tên tùy ý không cần migration; theo mặc định đề xuất, test ba tổ hợp review/rebuttal hợp lệ và reject rebuttal bật khi review tắt; kiểm tra deadline hợp lệ |
| 09 — Versioned submissions | Giữ nguyên | Submissions/storage: một logical Submission/project/stage, version bất biến, SHA-256, metadata, PDF validation, random key | E02; checksum file thật; version cũ không bị ghi đè; upload concurrent không trùng version; test MIME/extension/size/empty file và access file |
| 10 — Workflow state | Giữ nguyên | Workflow: state machine backend, transition theo stage config, audit | Unit test mọi cạnh hợp lệ/bất hợp lệ; integration deadline boundary và audit; test race submit/transition; không suy state chỉ từ UI |
| 11 — Reviewer assignment | Giữ nguyên | Assignments: instructor reviewer và peer group; manual + deterministic auto-assignment, workload/explanation | E03; unit self/duplicate/shared member/reciprocal/capacity/workload/determinism; cùng input cho cùng output; infeasible không âm thầm phá hard constraint |
| 12 — COI | Giữ nguyên | Assignments/COI: automatic data-backed rules, self-declaration, decision/replacement, historical check extension point | E04; approve/reject quyền đúng; assignment cũ mất quyền sau approve/reassign; rerun không tạo duplicate; decision/reassignment atomic và audit |
| 13 — Review model | Giữ nguyên | Reviews/rubric: criterion score/comment, overall/strength/weakness/recommendation cấu hình, group draft, submitter, exact version | E05; instructor review riêng; min/max/required criterion validation; collaborative edit conflict; submitted immutable; authorized correction giữ lịch sử |
| 14 — Reviewer anonymity | Giữ nguyên | Policy/serialization: NAMED và ANONYMOUS_TO_AUTHORS; instructor luôn thấy identity trong offering được quản lý | E05, AD06–AD07; S02 kiểm tra API/nested DTO/discussion/notification/archive/metadata/SSR cache; không chỉ ẩn tên trong UI |
| 15 — Rebuttal | Giữ nguyên | Rebuttal: một group rebuttal/submission, general + review-specific response, deadline/finalize/reopen | E06; trước window/sau deadline/finalized bị chặn; instructor reopen audit; không gắn response vào review thuộc submission khác |
| 16 — Review discussion | Giữ nguyên | Discussion: context submission/review, scoped access, anonymity-aware author label | S02/S03; reply cross-submission bị từ chối; reviewer bị hủy assignment mất quyền; nội dung render an toàn; không tạo general chat |
| 17 — Final report/COOPY | Giữ nguyên | Similarity: manual asynchronous queue, trạng thái PENDING/SUBMITTED_EXTERNALLY/COMPLETED/FAILED/WAIVED, optional result PDF | E07; pending tạo đúng version và idempotent; failed/waived bắt buộc reason; transition và file ACL; không có COOPY API giả; copy không kết luận plagiarism |
| 18 — Grading | Giữ nguyên | Grades/UI: evidence workspace, draft/published, criterion/overall/feedback, publish audit | E08; draft không xuất hiện qua bất kỳ author API/cache/notification; publish hợp lệ và thấy ở student; evidence/grade gắn đúng version/rubric |
| 19 — Cross-semester archive | Giữ nguyên | Archive: reference publication trên Project gốc, own historical projects, filter/search, approval/revoke/access policy | E09; không copy toàn bộ Project sang archive; closed/archived + approval + eligibility; student search hạn chế; revoke/file policy; không unrestricted bulk download |
| 20 — Notifications | Giữ nguyên | Notifications: DB-backed inbox/read state, assignment/deadline/COI/review/rebuttal/final/similarity/grade events | Integration event→recipient→inbox; S02 identity-safe payload; duplicate job không duplicate notification; event transaction rollback không tạo notification giả; deadline job có test clock |
| 21 — Audit log | Giữ nguyên | Audit: actor/action/entity/time/metadata, administrative/academic changes, privileged file access | Integration audit cùng transaction với thay đổi; không có normal update/delete audit endpoint; filter quyền đúng; không ghi password/token/file body vào metadata |
| 22 — Authorization | Giữ nguyên | Auth/policy: RBAC + context, các hàm policy tập trung, authorization mọi endpoint | S01–S04; route/resource/action permission matrix; instructor ngoài offering và student khác group bị từ chối; kiểm thử cả read/write/file/list/nested endpoint |
| 23 — Admin functionality | Giữ nguyên | Admin: search/create/activate/deactivate/reset password/global role/course catalog/audit | E2E admin smoke; S04 revoke sessions khi deactivate/reset/role đổi theo policy; non-admin bị chặn; không thêm impersonation ngầm |
| 24 — Student UI | Giữ nguyên, UI base thay bằng OpenReview | Frontend student: login/dashboard/offering/project/submission/reviews/rebuttal/archive/profile | E02/E05/E06/E08/E09; password change; loading/error/empty; responsive và keyboard; version history, deadlines và status lấy từ API |
| 25 — Instructor UI | Giữ nguyên, UI base thay bằng OpenReview | Frontend instructor: dashboard/course/config/roster/groups/assignments/COI/monitor/similarity/grading/archive | E01/E03/E04/E07/E08/E09; dashboard counts/queues đúng DB; approval/revoke, workload, copy config và consolidated evidence dùng data thật |
| 26 — Admin UI | Giữ nguyên | Frontend admin: dashboard/users/catalog/audit filters | E2E admin smoke: create/update/deactivate/reset/role; audit actor/action/entity/date filtering; access bị chặn khi dùng non-admin |
| 27 — UI/UX/accessibility | Giữ nguyên | Frontend: ProView colors, timeline/badges/progress/deadline, accessible forms, responsive states | Component/UI checks ở desktop/tablet/mobile; keyboard/focus/labels/contrast; destructive/final action confirmation; lỗi API được hiển thị hữu ích |
| 28 — Security | Giữ nguyên | Auth/security/storage: password hash, token/cookie, CSRF/CORS, rate-limit, headers, safe render, validation, secret/error hygiene | S01–S10; no token/password in logs; real upload/access negative tests; refresh rotation/revocation replay; file không public static |
| 29 — Database/seeds | Giữ nguyên | Database/fixtures: schema/migrations/indexes và demo admin, instructor, 8–12 student, active + historical/later offering data | Clean DB migrate + seed; seed repeat behavior documented; valid real PDF fixtures; có pending/completed similarity, rebuttal, graded archived project; production không dùng demo password |
| 30 — API quality | Giữ nguyên | API/contracts: REST resource names, validation/status/error envelope, pagination/filter/sort, OpenAPI, DTO | Contract tests; generated client/type compatibility; malformed inputs; list isolation/pagination; response DTO không có secret/internal fields |
| 31 — Required tests | Giữ nguyên, bổ sung mục 57 | QA + mọi feature agent: unit/integration/component/E2E suite | E01–E10 và AD01–AD11; CI dùng DB/storage thật cho integration/E2E; báo số pass/fail/skip và lưu artifact; không bỏ test để có CI xanh |
| 32 — Documentation | Giữ nguyên, thêm hai upstream docs | Docs/integrator: README, architecture/domain/workflow/authorization/database/api/testing/deployment-checklist | Reviewer làm theo README từ clean checkout; permission/state matrices khớp code; link/lệnh/env được kiểm tra; cập nhật theo final implementation |
| 33 — Development environment | Giữ nguyên | DevOps: `.env.example`, Docker Compose, dependency/bootstrap/migrate/seed/dev scripts | Clean-machine rehearsal từ images/deps sẵn có; healthchecks/readiness; container và host URL đúng; không commit secret |
| 34 — Production readiness | Giữ nguyên | QA/DevOps/integrator: chạy đủ 13 bước validation, sửa lỗi thực | Evidence ghi command/exit code/commit/runtime; migrations+seed DB rỗng, formatter/lint/types/all tests/build API+web/local production smoke đều pass |
| 35 — Out of scope | Giữ nguyên | Mọi nhóm: tránh LMS/general chat/AI grading/plagiarism judgment/COOPY API/microservices/Kubernetes | Scope/code/navigation review; không đưa external service bắt buộc vào core workflow |
| 36 — Implementation order | Điều chỉnh lịch thực thi, giữ đủ chức năng | Integrator: dependency waves thay vì đợi phase 17 mới test; policy/audit/notification contracts sớm, frontend song song sau contract | Mỗi wave có gate và owner; không bắt đầu việc phụ thuộc contract chưa khóa; feature test đi cùng implementation |
| 37 — Engineering rules | Giữ nguyên | Mọi nhóm: focused modules, transactions, explicit code, tránh abstractions vô ích | Review module/transaction boundaries; race/rollback tests cho upload/assignment/COI/publish; không business logic trong React |
| 38 — Final acceptance | Giữ nguyên | Release QA: clone→deps→env→migrate→seed→login ba role→toàn bộ vòng đời | Recorded clean checkout rehearsal và E01–E10 pass bằng production builds local; không sửa source để chạy demo |
| 39 — Do not deploy | Giữ nguyên | DevOps: production build/Docker/env/storage/HTTPS/backup/migration/deployment commands, dừng trước external hosting | Có deployment-checklist và local production smoke; không gọi deploy/publish/provision cloud; operator-supplied secrets được liệt kê |
| 40 — Final handoff | Giữ nguyên cho giai đoạn implementation sau | Integrator: architecture/decisions/modules/DB/demo/run/test/build/external values/next deployment step | Handoff dẫn evidence thật, tách pass/fail/not-run; không biến kế hoạch hiện tại thành tuyên bố hệ thống đã hoạt động |
| 41 — OpenReview frontend base | Bổ sung, ghi đè frontend từ đầu | Upstream/frontend: thực sự tái sử dụng/adapt openreview-web; backend ProView độc lập | Review baseline ancestry/provenance và components tái sử dụng; không chỉ skin/đổi tên; Next production build |
| 42 — Inspect upstream first | Bổ sung, prerequisite trước code frontend | Upstream: clone official current repo, pin commit/tag/license; đọc README/LICENSE/CONTRIBUTING/package/router/components/forms/forum/profile/client/auth/tests | `openreview-adaptation.md` có audit thực và kết quả baseline checks hoặc blocker cụ thể; không giả định cấu trúc từ trí nhớ |
| 43 — License requirements | Bổ sung | Upstream/docs: xác minh license ở pinned commit, giữ notices/AGPL file, derivative attribution/modification record/source structure | Kiểm tra `upstream-openreview.md`, license và notices trên reused files; upstream URL/hash và inventory đầy đủ; không copy repo chưa xác minh license/public access |
| 44 — Own backend | Bổ sung | API/frontend data: Nest/Prisma/auth/policies/storage riêng; REST client `lib/api/*` | AD01/AD02/AD04/AD05/AD11; không account/token OpenReview; normal workflow chỉ gọi API ProView |
| 45 — Keep Next.js | Ghi đè React+Vite requirement | Frontend nền tảng: giữ Next và upstream build system; TS code mới, JS cũ khi hợp lý | Build config/package review; strict typecheck cho code TS mới; không whole-repo rewrite/migration vì hình thức |
| 46 — Reuse review UX | Bổ sung | Frontend adaptation: listing/detail/PDF/forms/reviews/discussion/score/identity/profile/status/tabs/loading/error | Component reuse inventory + submission workspace screenshots/E2E; adapters nối domain mới; không giữ coupling vô ích |
| 47 — Remove conference features | Bổ sung | Frontend cleanup: route/navigation/runtime excludes conference venue/chair/bidding/discovery/publication/import/... | AD03; trực tiếp mở legacy route không chạy conference workflow; removed routes không còn auth bypass/network dependency; dead code được cô lập nếu giữ |
| 48 — Concept mapping | Bổ sung | Upstream/domain: mapping Venue→Offering, Note/Paper→Submission, Authors→Group, Invitation→Rubric/Assignment, Decision→Grade, Revision→Version,... | `openreview-adaptation.md` có mapping trước UI implementation; database vẫn explicit ProView entities, không Note/Invitation generic schema |
| 49 — Information architecture | Bổ sung | Frontend shell: menu Student/Instructor/Admin như đặc tả, labels course/submission/review assignment | AD03 + role navigation tests; deep-link authorization; không Venue/Note/Invitation xuất hiện như domain label |
| 50 — Branding | Bổ sung | Frontend shell: ProView name/subtitle/navy/accent, restrained academic UI; source attribution giữ nguyên | Visual check login/layout/error/profile và browser metadata; bỏ public-site OpenReview marketing; license notices còn |
| 51 — Central submission experience | Bổ sung | Frontend workflow: cùng context submission+PDF+version+review+rebuttal+discussion, role-specific controls/identity/grade/similarity | E02/E05–E08 và AD04–AD09; author/reviewer/instructor nhận đúng DTO và action; responsive page usable |
| 52 — Domain adaptation, not skin | Bổ sung | Frontend/API: thay fetch/auth/domain dependencies, simplify classroom workflow, isolate obsolete assumptions | AD01–AD11; code review không còn chairs/Notes/Invitations trong normal data flow; ProView DTO→view model→components |
| 53 — Adapter/view model layer | Bổ sung | Frontend contracts: ProjectSubmission/Review/Assignment/Rubric/Rebuttal/Offering/Grade view models; refactor/copy minimal/replace phù hợp | Adapter unit tests; component không nhận raw Prisma/backend object; input anonymous DTO thiếu identity vẫn render đúng; mapping không tái tạo identity |
| 54 — No generic invitation system | Bổ sung | Domain/API: explicit relational CourseOffering/SubmissionStage/Project/Submission/Version/Assignment/Review/Rubric/Rebuttal/Grade/SimilarityCheck | Schema/API review; reviewer form và stage config không yêu cầu generic Note/Invitation store |
| 55 — Controlled adaptation A–F | Bổ sung | Integrator/frontend: Baseline→Shell→Data→Core UI→Secondary UI→Cleanup, tích hợp theo slices | Wave gates nối baseline/API contracts; mỗi slice chạy API/UI tests; cleanup gate cuối xác nhận route/domain/network/license |
| 56 — No OpenReview runtime dependency | Bổ sung | Frontend/DevOps/security: source scan, offline execution, network allowlist | AD11 + S09; browser và Next/backend server không gọi OpenReview; assets/PDF worker/font không đòi CDN; docs/attribution links được phân biệt runtime calls |
| 57 — Adaptation tests | Bổ sung | QA/frontend: 11 test assertions bên dưới | AD01–AD11 pass trong E2E với production builds; dùng interception và egress-restricted run, không chỉ source grep |
| 58 — Fixed upstream boundary | Bổ sung | Upstream/integrator: một pinned commit là baseline derivative, không yêu cầu theo HEAD liên tục | URL/hash/tag nếu có và lockfile lưu trong repo; change log xác định reused/replaced/modified paths; không thêm auto-upstream-sync framework |
| 59 — Revised definition of done | Bổ sung, hợp nhất backend DoD | Integrator/QA: ProView UX/API/auth độc lập, OpenReview-derived review UX, đúng license, no conference workflows, production build + E2E | Mọi mục 01–58 có evidence; cả backend và frontend gates pass; final handoff không claim vượt evidence; không deploy |

## E2E nghiệp vụ bắt buộc — mục 31

Các flow chạy qua giao diện với backend và DB thật; có thể dùng API fixture để chuẩn bị dữ liệu độc lập, nhưng các thao tác đang được kiểm thử không được thay bằng mock. Mỗi test có data riêng, thời gian cố định và teardown/reset xác định.

| ID | Flow và dữ liệu tối thiểu | Assertions bắt buộc | Yêu cầu liên quan |
| --- | --- | --- | --- |
| E01 | Instructor login → create/copy offering → stages → roster CSV/individual → groups → rubric | Copy chỉ configuration; student không public enroll; mỗi student tối đa một active group/offering; config/roster audit đúng | 05–08, 13, 21–22, 25, 31 |
| E02 | Student → project → Proposal v1 → v2 → submit v2 → history | Cả hai file/checksum/version tồn tại; current submitted v2; download/view version ACL; actor/time/change note đúng | 09–10, 24, 28, 31, 51 |
| E03 | Instructor auto-assign reviewers cho nhiều groups | Không self/shared member/duplicate; workload hợp lý theo constraints; reciprocal được tránh khi khả thi; kết quả và explanation ổn định | 11–12, 25, 31 |
| E04 | Reviewer declares COI → instructor approves → replacement | COI reason/decision audit; assignment cũ không review/view vượt quyền; replacement hợp lệ; tác vụ rerun không duplicate | 11–12, 21–22, 31 |
| E05 | Peer group collaborative draft → student representative submits structured review → instructor và author xem | Exact reviewed version; submitter ghi đúng; instructor thấy identity; author ANONYMOUS không thấy trong payload; NAMED case riêng; draft/submitted edit rules | 13–14, 22, 24–25, 31, 51 |
| E06 | Rebuttal window mở → author submits general/review-specific rebuttal → instructor xem cùng review | Đúng group/submission; deadline/finalize khóa edit; instructor reopen theo policy và audit; scoped discussion không rò identity | 15–16, 21–22, 31, 51 |
| E07 | Final report submit → similarity PENDING → staff marks external → records result/PDF → grading view | Không call COOPY API; check cùng version; percentage/date/notes/file lưu đúng; FAILED/WAIVED bắt reason qua integration companion tests | 17–18, 25, 28, 31 |
| E08 | Instructor draft grade → student xem → publish → student xem lại | Draft không có trong author API/UI/cache; published visible; criterion validation và publish audit; evidence version đúng | 18, 21–22, 31 |
| E09 | Close source offering → approve archived report → later eligible student views → revoke | Approval + eligibility + source status đồng thời; non-approved/private denied; own history đúng; inline/file/download policy; revoke hiệu lực | 19, 22, 24–25, 31 |
| E10 | Student không liên quan gọi trực tiếp API/file của private submission | API/file/list/nested/HEAD/Range tương ứng không trả private bytes/data; role không đủ khi context sai; frontend hiding không phải bằng chứng | 22, 28, 31 |

Ngoài 10 scenario trên phải có: admin UI smoke; profile/password change; notifications/read state/deadline job; instructor-as-reviewer; stage bổ sung; NAMED mode; mobile/keyboard; upload/storage error paths. Đây là coverage bổ sung cho yêu cầu gốc, không thay thế các scenario bắt buộc.

## E2E adaptation bắt buộc — mục 57

Không cần tạo 11 test độc lập nếu assertions đã nằm trong E01–E10; test report phải chỉ ra mapping và tránh chỉ kiểm tra text tĩnh.

| ID | Assertion adaptation | Mapping và bằng chứng |
| --- | --- | --- |
| AD01 | Student login không redirect tới OpenReview | E02/E05: redirect/cookie/token/session hoàn toàn thuộc ProView; theo dõi network/URL |
| AD02 | Không cần OpenReview account | E01/E02: tài khoản seed/local mới chưa tồn tại trên OpenReview vẫn hoàn thành flow; môi trường không có OpenReview credentials |
| AD03 | Course navigation không có conference workflow | E01 + role navigation/legacy deep-link tests; route bị loại/cô lập không phát request conference API |
| AD04 | Project submission render từ ProView API | E02: fixture thật thay title/version làm UI đổi tương ứng; request vào REST ProView và adapters |
| AD05 | Review form save về ProView backend | E05: save draft/reload/submit và DB assertions; không mock successful response |
| AD06 | Anonymity còn được bảo vệ | E05 + S02: kiểm tra response body/SSR/RSC/query cache/notifications, không chỉ DOM |
| AD07 | Instructor thấy reviewer identity | E05: cùng review có instructor DTO/view chứa identity đúng; instructor ngoài offering bị từ chối |
| AD08 | Rebuttal hoạt động | E06: create/edit/finalize/reload và permissions thật |
| AD09 | Grading hoạt động | E08: draft secrecy → publish visibility, evidence từ ProView |
| AD10 | Archive hoạt động | E09: cross-semester, approval/revoke/eligibility/file ACL |
| AD11 | Không normal workflow gọi OpenReview production | Global Playwright request guard cho `openreview.net` và subdomains; source/dependency/config scan; production local run chặn outbound ở server/container để bắt SSR/API calls; browser-only interception không đủ |

## Ma trận bảo mật và tính toàn vẹn bổ sung

| ID | Phạm vi | Cases tối thiểu |
| --- | --- | --- |
| S01 | Context authorization/IDOR | Author, reviewer, unrelated student, instructor cùng/khác offering, admin được cấp quyền, user bị deactivate; list/detail/create/update/delete và file; relation ID khác offering/stage/project bị từ chối |
| S02 | Anonymity và draft secrecy | Reviewer group/student name, email, IDs liên kết, submittedBy/author fields, nested relations, discussion, notification title/body/target, review metadata, archive, audit access, frontend preloaded/SSR/RSC state/cache. Không đưa identity vào response rồi để frontend xóa |
| S03 | State/deadline/version binding | Before open, exact deadline, after deadline, finalized/reopened; optional review/rebuttal stages; version mới không thay nội dung đang được review hoặc biến check cũ thành kết quả cho file mới; rubric đã dùng không thay lịch sử |
| S04 | Session/authentication | Login rate-limit, invalid credentials/errors, short access TTL, refresh HttpOnly/Secure production/SameSite, rotation or explicit revocation, replay, logout, password change/reset, role/deactivation changes, CSRF theo auth model, CORS allowlist |
| S05 | File security | PDF extension/MIME/magic bytes hợp lệ, empty/oversize/spoofed input, random key/path traversal/unsafe Content-Disposition, checksum, temp cleanup khi rollback, direct bucket/static denied, authorized HEAD/Range, result PDF cũng được bảo vệ |
| S06 | Concurrency và rollback | Double upload/version number, student vào hai group, repeated auto-assign, simultaneous review draft edits, submit/reopen race, duplicate COI approval/replacement, repeated finalize/publish, check/notification idempotency; unique constraints + transaction behavior |
| S07 | Content/error/log hygiene | Stored/reflected XSS trong title/comments/Markdown, safe URL protocols, CSV/form DTO validation, SQL filters, error không stack/internal secret; log/audit không password/token/PII không cần thiết |
| S08 | Archive policy | Status CLOSED/ARCHIVED, explicit published version, eligible later cohort của cùng course theo policy đã chốt, own historical membership, revoke, student search privacy, bulk listing/download restriction; hidden download button không đồng nghĩa DRM |
| S09 | Offline independence | Sau khi có packages/browser binaries/container images, toàn bộ core flow chạy khi Internet tắt; kiểm cả browser và Next/API; local PDF worker/fonts/assets; không external auth/OpenReview/COOPY dependency |
| S10 | Operational separation | Demo seed/dev password không bật production; secrets env-only; non-root/read-only nơi phù hợp; healthcheck không leak config; migration/backup/restore rehearsal không chạm dữ liệu ngoài local test |

Anonymity trong phạm vi hệ thống là bảo vệ identity/metadata mà nền tảng kiểm soát. Free text do reviewer tự viết có thể tự tiết lộ danh tính; không hứa tự động phát hiện và xóa mọi tự nhận diện. Anonymous-to-authors cũng không đồng nghĩa double-blind: đặc tả không yêu cầu che tác giả khỏi reviewer.

## Release gates và cách lưu bằng chứng

Tên và phạm vi gate dưới đây khớp kế hoạch chính. G0–G6 đều đang **PLANNED**; không có gate nào được tuyên bố đạt trong lần lập kế hoạch này.

| Gate | Điều kiện nghiệm thu liên quan ma trận | Evidence chính |
| --- | --- | --- |
| **G0 — Đủ rõ để giao việc** | Coverage 59 mục, ownership, ADR cho các mặc định đề xuất; DTO/permission/state contracts; upstream URL/commit/license được xác minh trước import | A00/A01 handoff; domain/policy/state matrices; baseline logs và blockers được phân biệt rõ |
| **G1 — Nền tảng chạy thật** | Workspace install/build nền, DB rỗng migrate/seed tối thiểu, auth/session/policies, audit/notification foundation, storage convention, Next shell ProView | A02–A04/A13a/F00 checks; AD01–AD02; S01/S04 cho nền tảng; no OpenReview login dependency |
| **G2 — Lát cắt setup/submission** | Offering/copy/stages/roster/groups/rubric; upload v1/v2, submit exact version; UI validation; private file controls | E01–E02; AD04; S03/S05/S06 liên quan membership/upload/version; audit và notifications của slice |
| **G3 — Review đáng tin cậy** | Assignment/COI/review, released author projection và instructor identity; API và UI hoạt động; correction/optimistic locking | E03–E05; AD05–AD07; S01–S03/S06/S07; phần review release và UI phải có trước khi ký gate |
| **G4 — Hoàn chỉnh nghiệp vụ học thuật** | Rebuttal/discussion/reopen; final/manual COOPY; correct-version evidence và grade draft/publish | E06–E08; AD08–AD09; S02/S03/S05/S06 liên quan; similarity failed/waived/retry cases |
| **G5 — Toàn bộ chức năng người dùng** | Archive/cohort sau, đủ pages/dashboards/admin/profile/notifications; full seed; conference routes cô lập; branding/license đúng | E09–E10; AD03/AD10; S08; admin/profile/inbox/reminder/accessibility smoke; full seed và source inventory |
| **G6 — Release local** | Format/lint/types/all tests, clean DB migrate+seed, API/web production builds + Docker + production E2E, offline browser/server, README rehearsal, docs/handoff; không deploy | Regression E01–E10, AD01–AD11, S01–S10; Q01 report; backup DB+storage/restore rehearsal, production smoke và operator env checklist |

Theo kế hoạch chính, báo cáo cuối tại `docs/evidence/verification.md`; từng task có `docs/tasks/<ID>.md`. Evidence gồm: commit SHA; ngày/giờ và runtime/package versions; chính xác command; exit code; kết quả test và các skipped tests kèm lý do; đường dẫn Playwright trace/screenshot/report; migration/seed evidence; production health/smoke; các giá trị operator còn phải cấp. Không commit secret hoặc ảnh/log chứa dữ liệu nhạy cảm. “Not run”, “blocked” và “failed” phải phân biệt với “passed”. Không bỏ required checks để ký G6.

## Mặc định đề xuất cần ghi thành ADR trước triển khai

Các lựa chọn dưới đây đồng bộ với `implementation-plan.md` và task packages. Đây là **đề xuất để A00 chốt thành ADR**, không phải xác nhận người dùng đã phê duyệt mọi chi tiết hay hệ thống đã implement. Nếu thay đổi một default, cập nhật đồng thời contract, policy, acceptance tests và tài liệu liên quan.

| Chủ đề | Mặc định đề xuất và assertions cần giữ |
| --- | --- |
| Thời gian/state | UTC trong DB, timezone hiển thị theo offering; đúng deadline coi là đóng. Backend guard từng mutation dù scheduler chưa chạy; read không âm thầm đổi state; reopen explicit/audited với hạn hiệu lực rõ. A00 ghi các transition/skip/late rules. |
| Version/evidence | Upload tạo immutable draft; submit chọn exact version. Assignment/review pin version; review bắt đầu thì student không thay evidence đang xét; instructor reopen xử lý liên đới bằng transaction, giữ lịch sử. Similarity/grade/reference publication đúng version. |
| Rubric/score | Rubric đã dùng bị khóa, cần đổi thì clone. Criterion normalized và weighted average ra thang 0–10 với Decimal; scoreMax > scoreMin, weight tổng dương; overall override cần reason/audit. Không tự lấy peer average làm grade. |
| Membership | Editable trước mốc khóa, mặc định khóa từ lần submit đầu tiên; giữ historical membership. A00 ghi rõ quyền thành viên đã rời group và lịch sử ownership trước khi test archive. |
| Archive | Own projects theo historical membership; reference là exact published version, source CLOSED/ARCHIVED, viewer thuộc offering sau của cùng Course. Inline mặc định; download chỉ explicit allowDownload; ưu tiên authorized backend stream để revoke ngay; không mở private reviews/grades theo reference access. |
| Similarity/grading | Stage yêu cầu similarity chỉ publish grade khi COMPLETED/WAIVED đúng version; FAILED/PENDING/wrong-version bị chặn. FAILED/WAIVED bắt reason. Không ngưỡng kết luận đạo văn; similarity là textual similarity. |
| Assignment/COI | Hard constraints không bị phá; ưu tiên đủ demand và nghiệm không reciprocal nếu tồn tại, rồi workload; tie-break ổn định. Preview rõ thiếu capacity; apply explicit/atomic/revalidate/idempotent, không âm thầm giảm count. Timeout chưa chứng minh infeasible. COI pending pause review, rejected restore, approved revoke và replacement lineage. |
| Review release/correction | Release theo đợt khi đủ required reviews hoặc instructor audited close; author không thấy drafts/unreleased. Correction do instructor authorize có reason và immutable revision. A00 ghi rõ visibility review của reviewer khác và instructor-reviewer labels. |
| Optional stages | Rebuttal bật yêu cầu reviews bật; stage không reviews skip review/rebuttal; stage bổ sung không đổi schema. Test cả ba tổ hợp hợp lệ và tổ hợp không hợp lệ. |
| CSV/auth/notifications | Roster validate+preview rồi atomic commit; chỉ existing accounts, unknown email báo để Admin tạo. Refresh rotation/reuse detection, logout/reset/deactivation/session revoke; role changes cập nhật quyền theo ADR. A13/A00 còn phải chốt thời điểm reminder và deduplication semantics. |

Các chi tiết còn phải được A00 ghi rõ: quyền academic riêng của admin; visibility reviews giữa peer reviewers; labels của instructor reviewer; quyền former group members; rule late/reopen; semester ordering; exact correction/republication commands; reminder schedule. Những điểm này được giải quyết trong contract/ADR trước module phụ thuộc, không giao cho nhiều agent tự chọn khác nhau.
