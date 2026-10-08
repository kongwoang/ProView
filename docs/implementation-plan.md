# ProView — Kế hoạch triển khai cho các agent

Ngày lập: 07/10/2026; cập nhật thực thi: 08/10/2026. **Các luồng nghiệp vụ đã được triển khai và kiểm thử tích hợp; nghiệm thu toàn bộ tiêu chí vẫn đang tiếp tục.**

Repository hiện có frontend OpenReview/Next.js, API NestJS, PostgreSQL, local/S3 storage, Docker và CI. Xem [trạng thái thực thi](implementation-status.md) và [bằng chứng](evidence/implementation-verification.md). Nội dung bên dưới giữ yêu cầu và dependency để đối chiếu, không phải báo cáo tất cả đã PASS.

## 1. Cách đọc và giao việc

1. Đọc [đặc tả gốc](specifications/01-proview-original.txt), áp dụng [bản bổ sung OpenReview](specifications/02-openreview-override.txt) khi có xung đột.
2. Đọc kế hoạch này để hiểu kiến trúc, phụ thuộc và điều kiện hoàn thành.
3. Dùng [quyết định nghiệp vụ](domain-decisions.md) làm đầu vào cho schema, workflow, policy và API.
4. Dùng [kế hoạch frontend](frontend-adaptation-plan.md) cho việc khảo sát và chuyển đổi OpenReview.
5. Giao từng gói trong [danh sách task](agent-tasks.md), không giao toàn bộ đặc tả cho nhiều agent cùng sửa.
6. Cập nhật [ma trận yêu cầu](requirements-matrix.md) bằng đường dẫn code/test và bằng chứng thực tế khi hoàn thành.

Các mặc định được đề xuất trong tài liệu này phải được agent điều phối ghi thành ADR trước khi các agent tính năng bắt đầu. Chúng làm rõ phần đặc tả còn thiếu, không phải tính năng đã được xây dựng. Thay đổi mặc định cần cập nhật cùng lúc contract, policy, test và tài liệu liên quan; không tự ý cắt yêu cầu khó.

## 2. Kết luận kiến trúc

- **Frontend:** một ứng dụng dẫn xuất thực sự từ `openreview/openreview-web`, giữ Next.js và router của upstream. Không tạo ứng dụng Vite mới, không thêm React Router để thực hiện phần bị override.
- **Backend:** NestJS modular monolith, REST `/api/v1`, OpenAPI, nghiệp vụ và phân quyền tập trung ở backend.
- **Dữ liệu:** PostgreSQL + Prisma, migration có constraint và index; lịch sử submission, review và quyền sở hữu được bảo toàn.
- **File:** StoragePort + LocalStorageAdapter và S3StorageAdapter; MinIO kiểm thử S3 tại máy local. Bucket private, truy cập qua backend được kiểm quyền.
- **Auth:** ProView tự quản lý tài khoản, access token ngắn hạn, refresh token luân chuyển trong HttpOnly cookie, session/revocation lưu DB. Không tài khoản hay token OpenReview.
- **Background work:** scheduler trong cùng backend, PostgreSQL lưu job/reminder có khóa và deduplication. Chưa cần Redis, message broker, microservice hoặc Kubernetes.
- **Tổ chức:** pnpm workspace; môi trường local có PostgreSQL, MinIO và profile production cho API + Next.js + reverse proxy cùng origin.
- **Đích bàn giao:** clone → cấu hình → migrate → seed → build → chạy production local → hoàn tất nghiệp vụ. Không deploy ra hosting.

Luồng chính:

```text
Browser
  → Next.js: layout / routes / components / view models
  → ProView REST API: guards / policy / DTO projection
  → domain services: workflow / assignments / reviews / grades
  → Prisma + PostgreSQL, StoragePort + private files
```

Next.js có thể proxy transport và render giao diện; không trở thành backend nghiệp vụ thứ hai. Không đưa Prisma vào frontend hoặc tái tạo mô hình Note/Invitation của OpenReview.

## 3. Cấu trúc repository đích

```text
apps/
  api/
    prisma/                 # schema, migrations; một owner duy nhất
    src/common/             # errors, clock, validation, pagination
    src/modules/
      auth/ users/ courses/ offerings/ groups/ rubrics/
      submissions/ reviewer-assignments/ conflicts/
      reviews/ rebuttals/ discussions/ similarity-checks/
      grades/ archive/ notifications/ audit/ storage/
    test/
  web/                      # import từ upstream đã pin, giữ cấu trúc Next.js
    app/                    # route được allowlist cho ProView
    components/proview/     # component mới hoặc refactor từ upstream
    features/               # phân vùng theo domain, tránh sửa chung page lớn
    lib/api/                # typed client gọi ProView REST
    lib/adapters/           # DTO → view model, không quyết định quyền
    lib/view-models/
packages/
  shared/                   # contract public/generated types, enum, error codes
  config/                   # lint, format, TypeScript config
  test-support/             # factory, fixed clock, seed helpers cho test
scripts/                    # generate contracts, seed orchestration, smoke/offline
infra/                      # proxy config, Dockerfiles khi không đặt ở app
  # Tên và vị trí cuối cùng do A02 chốt; không duy trì config trùng lặp.
docs/
  specifications/           # nguyên văn 2 prompt
  adr/
  tasks/                    # progress + handoff từng task trong lúc implement
  evidence/                 # log/check summary, không chứa secret
README.md
pnpm-workspace.yaml
pnpm-lock.yaml
docker-compose.yml
.env.example
```

Các package bổ sung chỉ tạo nếu thực sự được sử dụng. Upstream có file JavaScript thì giữ khi phù hợp; code ProView mới dùng TypeScript strict. Không ép một đợt rewrite toàn bộ upstream hoặc một hệ CSS thứ hai chỉ để khớp prompt đầu.

## 4. Các quyết định phải khóa trước khi chia tính năng

| Vấn đề               | Mặc định đề xuất                                                                                                                                                                                                                    | Bằng chứng cần có                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Quyền theo lớp       | Global role xác định khả năng tổng quát; membership trong offering xác định quyền dữ liệu. Instructor lớp A không quản lý lớp B. Admin có quyền quản trị được liệt kê riêng.                                                        | Permission matrix + negative API tests.                                 |
| Trạng thái           | `SubmissionStage` là cấu hình; từng `Submission` có state machine riêng.                                                                                                                                                            | Bảng actor/from/to/guard/side effects.                                  |
| Upload và submit     | Upload tạo immutable draft version; submit chọn một version cụ thể; không tự submit chỉ vì upload thành công.                                                                                                                       | Hai upload, một submit, lịch sử và checksum còn nguyên.                 |
| Review version       | Assignment/review pin version; khi bắt đầu review, không để sinh viên thay version đang xét. Reopen do instructor phải xử lý assignment/evidence cũ theo transaction và giữ lịch sử.                                                | Test revision không làm review cũ đổi nội dung.                         |
| Rubric               | Không sửa criterion/weight của rubric đã được review/grade dùng; clone cấu hình thành phiên bản mới khi cần.                                                                                                                        | Review cũ không thay điểm khi cấu hình đổi.                             |
| Thành viên nhóm      | Cho sửa khi editable; mặc định khóa từ lần submit đầu tiên. Giữ membership history, không xóa bằng chứng sở hữu project cũ.                                                                                                         | Unique active group + history archive tests.                            |
| Deadline             | Lưu UTC; offering có timezone hiển thị; kiểm tra giờ backend trong mỗi mutation. Đúng thời điểm deadline được coi là đã đóng.                                                                                                       | Fixed clock: trước/bằng/sau hạn, timezone.                              |
| Mở review/rebuttal   | Release review theo đợt sau khi đủ review yêu cầu hoặc instructor chủ động đóng vòng có audit; rebuttal cần review đã release và còn hạn.                                                                                           | Review draft/unreleased không bị tác giả xem.                           |
| Stage tùy chọn       | `allowRebuttal=true` cần `allowReviews=true`; không review thì bỏ qua review/rebuttal; stage mới không cần đổi schema.                                                                                                              | Test mọi tổ hợp hợp lệ, reject config không hợp lệ.                     |
| Phân công            | Hard constraints: no self/shared membership/duplicate/cross-offering. Ưu tiên đủ review và nghiệm không reciprocal nếu khả thi; chỉ chấp nhận reciprocal khi không có nghiệm đủ tránh được, rồi tối ưu workload; tie-break ổn định. | Chạy lặp cùng dữ liệu ra cùng kết quả; báo infeasible.                  |
| Tính bất khả thi     | Không âm thầm giảm review count hay phá COI. Preview thiếu capacity, lý do và đề xuất operator; apply phải explicit, atomic. Search timeout là chưa kết luận, không phải chứng minh infeasible.                                     | Trường hợp 1–2 nhóm, nhiều COI, k quá lớn.                              |
| Sửa review đã submit | Instructor cấp phép correction có lý do; lưu revision/audit, không ghi đè bản đã chốt.                                                                                                                                              | Hai thành viên sửa đồng thời và correction test.                        |
| Chấm điểm            | Grade draft chỉ instructor được phép; publish gắn đúng version và rubric. Final có similarity bắt buộc chỉ publish khi `COMPLETED`/`WAIVED` đúng version.                                                                           | Grade draft private; similarity v1 không thỏa final v2.                 |
| Công thức điểm       | Mặc định criterion normalized theo `[scoreMin, scoreMax]`, weighted average → thang 0–10; tổng weight dương, scoreMax > scoreMin, Decimal. Override overall cần lý do/audit; không tự lấy peer average làm grade.                   | Boundary, missing criteria, rounding, override tests.                   |
| Archive              | Own projects theo historical membership. Reference chỉ version được publish, offering đã CLOSED/ARCHIVED, sinh viên thuộc offering sau của cùng Course.                                                                             | Có cohort cũ/mới; approve/revoke và access-file tests.                  |
| CSV roster           | Validate + preview errors rồi commit atomic; mặc định chỉ thêm tài khoản đã tồn tại; unknown email báo rõ để Admin tạo. Không phát password qua CSV.                                                                                | Duplicate row, email lạ, import lặp, wrong role.                        |
| Anonymity            | Backend xuất DTO theo audience. Alias ổn định trong một submission; không dùng ID thật trong alias. Instructor có membership hợp lệ luôn thấy thật.                                                                                 | JSON/nested/notifications/archive/SSR/RSC/cache/file metadata không lộ. |

Không dùng các đề xuất trên để tự mở rộng scope sang realtime collaborative editor, automatic plagiarism detection, AI grading, public enrollment hay hệ thống invitation tổng quát.

## 5. Contract chung giữa các agent

**API và dữ liệu**

- Backend OpenAPI là hợp đồng public; generate TypeScript client/types có kiểm tra drift. Frontend không import model Prisma.
- Chốt resource families và DTO ở A00/A03 trước khi frontend tính năng bắt đầu. DTO chứa đúng dữ liệu actor được phép xem; có thể trả `allowedActions` hỗ trợ UI nhưng backend luôn kiểm lại.
- REST lỗi thống nhất: `code`, `message`, `fieldErrors?`, `requestId`; không trả stack trace, storage key, token hay thông tin nội bộ.
- List endpoints có pagination, filter/sort allowlist; thống nhất ISO datetime, UUID, decimal serialization, page limits.
- Vi phạm workflow hoặc optimistic lock trả `409`; dữ liệu sai `400/422` theo một quy ước; không tồn tại/không được nhìn thấy dùng chính sách `404`/`403` thống nhất.

**Auth và frontend**

- Browser gọi API cùng origin `/api/v1`; access token mặc định giữ trong memory, refresh cookie HttpOnly. Không lưu refresh/access token vào localStorage.
- Client refresh single-flight, chống vòng lặp 401; logout/reset password/deactivate làm mất hiệu lực session và dữ liệu cache nhạy cảm.
- SSR ưu tiên shell không chứa private data nếu token model không hỗ trợ SSR an toàn. Nếu fetch private data phía server, phải chuyển đúng session và dùng no-store/private cache, không cache chéo người dùng.
- PDF viewer lấy file qua authorized request; nếu dùng object URL phải giải phóng, không biến bucket public. Range request cũng phải có authorization. Không nhét token vào URL.
- React Query key bao gồm context cần thiết; xóa private queries khi đổi tài khoản. Adapter chỉ chuyển hình dữ liệu, không phải rào chắn anonymity.

**Transactions và side effects**

- Domain mutation + audit + notification/outbox intent cùng transaction. Worker retry không tạo thông báo lặp.
- Optimistic concurrency cho review/rebuttal/grade draft; lock/constraint cho version number và membership; idempotency cho final submit/publish/import/auto-assignment apply.
- Upload không có transaction xuyên DB/object storage: dùng temp object + DB commit + compensation/cleanup có trạng thái rõ. Test DB fail và object store fail.
- Read-side không cập nhật trạng thái ngầm. Scheduler hỗ trợ deadline/reminder nhưng mọi lệnh vẫn guard theo clock backend.

## 6. Phân công và quyền sở hữu

A00 là agent điều phối/integrator, giữ kiến trúc, contract và quyết định merge. Các ID là **gói công việc**, không phải yêu cầu mở 23 agent cùng lúc.

| Nhóm              | Task                    | Trách nhiệm                                                   |
| ----------------- | ----------------------- | ------------------------------------------------------------- |
| Điều phối         | A00                     | Đặc tả, ADR, API/policy/state contract, review tích hợp.      |
| Nền tảng          | A01, A02, A03, A04, A13 | Upstream, workspace, DB, auth, audit/notifications.           |
| Backend nghiệp vụ | A05–A12, A14            | Course đến archive, quản trị tài khoản.                       |
| Frontend          | F00–F05                 | Shell và các feature nối API thật.                            |
| Chất lượng        | Q00, Q01                | Harness từ đầu; nghiệm thu toàn hệ thống và local production. |

Quy tắc ownership:

1. A03 sở hữu `schema.prisma` và tất cả migration; module owner gửi đề nghị thay đổi schema để A03/integrator áp dụng theo thứ tự. Không sinh migration cạnh tranh từ cùng baseline.
2. A02 sở hữu root package/workspace/config/lockfile/Compose; dependency request đi qua owner. Tránh nhiều agent chạy install và ghi lockfile đồng thời.
3. F00 sở hữu root layout, auth provider, query provider, API client, view-model convention, navigation. Feature owner làm trong subtree đã giao.
4. A04 sở hữu policy framework và serializer convention; mỗi module owner bổ sung policy cụ thể và test theo extension point đã chốt, không bỏ guard để unblock UI.
5. A13 sở hữu event registry/notification projection/audit writer; module owner phát event có dữ liệu tối thiểu, không tự gửi raw entity vào notification.
6. Không agent nào sửa folder của agent khác nếu chưa phối hợp. Nếu nhiều task chung module, dùng patch request hoặc handoff tuần tự.
7. Mỗi gói chỉ được nhận trạng thái DONE khi đã tích hợp với dependency thật và có log kiểm thử. Fixture/mock được dùng trong unit test; core flow chạy thật với PostgreSQL và storage.

Theo yêu cầu mới nhất của người dùng, chỉ chạy **một agent**, thực hiện các gói tuần tự. Các ID và ownership dùng để tổ chức scope; không tạo hoặc tiếp tục subagent. Lịch dependency bên dưới được giữ để chọn thứ tự công việc, không phải chỉ thị chạy song song.

## 7. Dependency graph và lịch triển khai

```text
A00: contract + ADR
 ├─ A01: upstream baseline ─┐
 └─ A02: infrastructure ───┼─ A03: schema/migrations
                          │    ├─ A04: auth/policies ── F00: shell/API
                          │    └─ A13a: audit/events/notification foundation
                          └─────────────────────────────────────────────┐
A04 + A13a ─ A05: courses/groups/rubrics ─ F01                            │
A05 ─ A06: storage/submissions ─ F02a                                    │
A06 ├─ A07: assignment/COI ─ A08: review ─ A09: rebuttal/discussion       │
    └─ A10: similarity ──────────┬──────────── A11: grading ─ F03          │
A08 + A09 + A10 ─────────────────┘                                       │
A11 ─ A12: archive ─ F04b                                                 │
A04 + A13a ─ A14: admin/profile ─ F05                                    │
A05/A07/A10/A13/A14 ─ F04a: dashboards/similarity/notifications/profile    │
A07 + A08 + A09 ─ F02b: review/discussion complete                        │
All domain events ─ A13b: final reminder/templates integration           │
Q00: test/contract/security harness xuyên suốt ──────────────────────────┤
All backend + frontend ─ Q01: full acceptance/local production ──────────┘
```

A11 chỉ được hoàn tất khi đã tích hợp evidence từ A08–A10. Có thể triển khai phép tính và draft grade sớm theo contract, nhưng chưa đánh dấu DONE. Tương tự F02/F04 và A13 có phần nền tảng và phần tích hợp cuối; tách ticket con nếu cần.

| Đợt | Công việc có thể chạy song song                       | Điều kiện kết thúc                                                                 |
| --- | ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 0   | A00 điều phối; workers A01, A02, Q00 thiết kế test    | G0: chốt scope, ADR, upstream provenance, contract sơ bộ.                          |
| 1   | A03; Q00 harness sau A02; F00 khảo sát shell sau A01  | Schema/constraints và fixture convention ổn định.                                  |
| 2   | A04; A13a; F00 shell theo contract                    | Backend auth/policy và audit nền sẵn để tích hợp shell.                            |
| 3   | A05; A14; F00 hoàn thiện auth/API                     | G1: shell auth/API thật; course/rubric/group và admin APIs có test quyền.          |
| 4   | A06; F01; F05                                         | Setup UI và submission APIs có acceptance; submission UI tiếp tục đợt 5.           |
| 5   | A07; A10; F02a submission/PDF                         | G2: setup → upload v1/v2/submit qua UI thật; assignment/similarity API sẵn.        |
| 6   | A08; F04a phần dependency đã sẵn; Q00 security review | Review APIs và privacy backend pass; hoàn thiện UI review ở đợt 7.                 |
| 7   | A09; A11 phần grade độc lập; F02b review              | G3: review/COI/anonymity API + UI; rebuttal/discussion xong, A11 tích hợp sau A09. |
| 8   | A12 sau A11; F03; F04a phần còn lại                   | G4: final report → manual COOPY → publish grade.                                   |
| 9   | F04b archive; A13b; Q00 full regression               | G5: archive/cohort mới, dashboards, admin, notification.                           |
| 10  | Q01 với integrator; workers sửa lỗi có owner rõ       | G6: clean-room setup, production local, offline, all checks pass.                  |

Đây là thứ tự theo dependency, không phải ước lượng ngày hoàn thành. Nếu gate chưa đạt, sửa nguyên nhân trong gói hiện tại; không đổi definition of done hoặc mock nghiệp vụ để tiến tiếp.

## 8. Gate nghiệm thu

### G0 — Đủ rõ để giao việc

- Hai đặc tả đã được hợp nhất; mapping đầy đủ mục 1–59.
- ADR cho auth, workflow/reopen, pinned versions, rubric, membership, score, archive eligibility, review release, assignment infeasibility, licensing provenance.
- API DTO/error/permission/state contracts có owner; mỗi task có path và acceptance.
- Upstream URL/commit/license được xác minh trước import. Baseline failure nếu có phải lưu log và phân biệt thiếu upstream backend với lỗi ProView.

### G1 — Nền tảng chạy thật

- pnpm install tái lập được, migration chạy DB trống, auth/password/logout/refresh rotation và seed tối thiểu chạy.
- Unknown/expired/deactivated accounts và cross-offering access bị chặn.
- Audit/notification transactional foundation và private file/storage convention đã có.
- Next shell dùng ProView auth/client, root routing không còn phụ thuộc login OpenReview.

### G2 — Lát cắt setup/submission

- Instructor tạo/copy offering, configure deadlines/rubric, import roster, lập nhóm.
- Student upload hai PDF, submit version chọn; file cũ và checksum còn nguyên.
- API chặn sai nhóm/lớp/deadline/type/size; không xuất private storage URL.
- UI có validation, empty/loading/error, confirmation phù hợp.

### G3 — Review đáng tin cậy

- Manual/auto assignment dùng cùng conflict policy; deterministic, cân bằng, không self/duplicate; infeasible có giải thích.
- COI pending/approved/rejected/reassignment giữ lịch sử, reviewer bị thu hồi không còn truy cập.
- Draft collaborative save có optimistic lock, submit immutable; correction được instructor cấp phép và audit.
- Instructor thấy identity thật; author anonymous không thấy qua bất kỳ projection nào, gồm HTML/RSC/cache/notification/discussion.

### G4 — Hoàn chỉnh nghiệp vụ học thuật

- Rebuttal đúng nhóm/window, finalize/expiry khóa; instructor reopen có lý do và hạn hiệu lực rõ.
- Final submit tự tạo similarity PENDING cho version đó; staff thao tác COOPY thủ công, nhập kết quả hoặc FAILED/WAIVED có lý do.
- Grading workspace tổng hợp evidence đúng version; draft bị ẩn; publish nhất quán với rubric, similarity, audit, notification.

### G5 — Toàn bộ chức năng người dùng

- Own archive, reference archive, approve/revoke, later cohort access chạy thật; private report vẫn bị chặn.
- Student, instructor, admin có đủ pages, profile/password, notifications, search/filter/pagination.
- Seed đủ role, 8–12 student, nhiều group, active/closed/later offering, submitted/review/rebuttal/similarity/grade/archive cases.
- Không còn conference routes có thể truy cập trực tiếp ngoài phần upstream đã cô lập khỏi build; branding ProView và license attribution đúng.

### G6 — Release local

- Formatter check, lint, typecheck, unit, integration, component, Playwright: tất cả pass.
- DB trống migrate + seed, seed re-run an toàn trong dev; migration không dựa vào `db push`.
- Production build frontend/backend và Docker production profile chạy được.
- Playwright chạy trên production local, có đủ 10 scenario nghiệp vụ và 11 adaptation checks trong prompt.
- Test chặn egress ở browser và server/container; local APIs/storage vẫn hoạt động khi Internet bị chặn; asset/font không tải từ CDN runtime.
- Cung cấp README và mọi tài liệu prompt yêu cầu; lưu log các lệnh thật, không ghi PASS suy đoán.
- Không deploy; handoff danh sách env/secret operator phải cung cấp và lệnh deploy dự kiến trong checklist.

## 9. Chiến lược QA và seed

Q00 bắt đầu cùng nền tảng, không đợi backend/frontend viết xong. Từng feature phải đưa unit/integration phù hợp cùng implementation; Playwright phát triển theo lát cắt chạy thật.

Test matrix tối thiểu:

- **Actor:** author, peer reviewer, student khác cùng lớp, student lớp khác, instructor đúng lớp/sai lớp, admin có/không quyền cần thiết, guest, deactivated account.
- **State:** draft/submitted/under review/rebuttal/review completed/finalized; review unreleased/submitted/corrected; grade draft/published; similarity pending/external/completed/failed/waived.
- **Time:** trước, bằng, sau deadline; explicit reopen; offering timezone khác UTC; scheduler chưa chạy.
- **Channels:** detail/list/nested DTO, file/range/result attachment, notification, discussion, archive, audit permissions, SSR/RSC/preload/cache.
- **Concurrency:** hai uploads; hai thành viên save review; double submit/publish/COI decision; auto-assign cùng lúc; worker retry/restart; approve rồi revoke archive.
- **Failures:** object store unavailable, DB transaction rollback, stale ETag/revision, expired refresh token, repeated refresh token, dependency restart.

Seed phát triển và test fixtures tách riêng. Demo seed dùng ngày tương đối có hướng dẫn; test dùng fixed clock nên không tự hỏng sau ngày lập dự án. Có PDF thật dung lượng nhỏ; không cần COOPY thật, vì quy trình yêu cầu staff nhập kết quả thủ công. Không dùng một test mock COOPY API vốn không tồn tại.

## 10. Tài liệu và bằng chứng cuối cùng

Các file sau **phải được viết/cập nhật khi triển khai**, không coi kế hoạch hiện tại là thay thế:

- `README.md`: prerequisites, env, Docker, migrate/seed, dev/test/prod, demo accounts.
- `docs/architecture.md`, `docs/domain-model.md`, `docs/workflow.md`, `docs/authorization.md`.
- `docs/database.md`, `docs/api.md`, `docs/testing.md`, `docs/deployment-checklist.md`.
- `docs/openreview-adaptation.md`, `docs/upstream-openreview.md`: baseline thật và actual reuse/replace/modification inventory.
- `docs/evidence/verification.md`: exact commands, commit, environment, timestamps, status, log locations.

Script contract đề xuất để A02/Q00 tạo và README kiểm chứng:

```text
pnpm install --frozen-lockfile
pnpm db:migrate:deploy
pnpm db:seed
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm test:web
pnpm test:e2e
pnpm build
pnpm verify:offline
```

Tên script và Compose profile chỉ trở thành hướng dẫn chạy thật sau khi A02/Q01 triển khai và chạy thành công. File `.env.example` cần DB, auth/session/secret, frontend/API origin, timezone nếu có, storage endpoint/bucket/region/credentials, upload limits, scheduler, source/attribution link.

Phân biệt chế độ build với môi trường dữ liệu: `NODE_ENV=production` dùng để kiểm thử production build tại local; `APP_ENV=local|test|production` xác định môi trường vận hành. Demo seed chỉ chạy khi explicit opt-in và `APP_ENV=local/test`, kể cả khi đang chạy production build. Với `APP_ENV=production`, cấm demo seed và fail-fast với placeholder secrets/cấu hình thiếu; không đưa tài khoản demo vào database triển khai thật. Local production dùng HTTPS proxy để kiểm cookie Secure, hoặc local-only HTTP override được tài liệu hóa và không cho bật trong môi trường production thật.

Backup checklist bao gồm PostgreSQL **và object storage**, restore đồng bộ metadata/files, migrate trước app startup có kiểm soát, HTTPS/reverse proxy, health/readiness, volume persistence, secret rotation. Không coi inline PDF là DRM: backend có thể hạn chế endpoint/download/rate, không thể ngăn người đã xem PDF lưu nội dung họ nhận được.

## 11. Mẫu lệnh giao việc cho agent

```text
Bạn thực hiện task <ID> trong docs/agent-tasks.md.
Đọc hai file docs/specifications, docs/implementation-plan.md,
docs/domain-decisions.md và tài liệu frontend nếu task liên quan UI.

Baseline đã được tích hợp: <commit / trạng thái workspace>.
Dependency đã DONE: <IDs>. Bạn chỉ sở hữu: <paths>.
Contract dùng chung: <DTO/policy/schema/version document>.

Triển khai đầy đủ task với dependency thật. Không sửa file ngoài ownership
mà chưa phối hợp. Không đổi schema, root lockfile hay common auth/API contract
để lách lỗi. Đề xuất patch cho owner nếu cần.
Không deploy. Không dùng mock cho core business flows.

Chạy acceptance checks của task. Báo lại:
- file và hành vi đã đổi;
- quyết định/contract hoặc migration cần owner xử lý;
- lệnh đã chạy và kết quả thật;
- bằng chứng quyền, rollback/concurrency nếu task có;
- điều kiện chưa xác minh và dependency còn thiếu.
DONE chỉ khi đã tích hợp, acceptance pass, không còn core TODO.
```

Integrator đọc diff, chạy test tích hợp liên quan rồi mới phát task phụ thuộc. Nếu đang dùng nhiều worktree, chọn baseline đã merge cho đợt tiếp theo; không cho agent phát triển dựa vào một contract chưa được chấp nhận.
