# ProView — Kế hoạch chuyển đổi frontend OpenReview

Ngày khảo sát: 07/10/2026; cập nhật: 08/10/2026. Frontend đã được nhập từ upstream chính thức và chuyển đổi sang API ProView. [Provenance](upstream-openreview.md), [thay đổi thực tế](openreview-adaptation.md) và [kiểm thử](testing.md) ghi bằng chứng; tài liệu này giữ kế hoạch đối chiếu.

Tài liệu này bổ sung [kế hoạch tổng thể](implementation-plan.md), thống nhất các task A01, F00–F05 và Q00/Q01 trong [danh sách task](agent-tasks.md). Đặc tả nguồn là [prompt gốc](specifications/01-proview-original.txt) và [bản bổ sung OpenReview](specifications/02-openreview-override.txt). Khi có xung đột frontend, bản bổ sung được ưu tiên.

## 1. Kết luận triển khai

Frontend phải được nhập từ một commit cố định của `openreview/openreview-web`, giữ React + Next.js và router/build system của upstream. Không tạo một frontend Vite mới, không thêm React Router, không sao chép mô hình Note/Invitation vào backend. NestJS, relational domain model và phân quyền ProView vẫn là nguồn thẩm quyền.

Tái sử dụng bố cục, cách trình bày submission/review và component phù hợp; thay auth, data fetching, generic invitation forms và conference orchestration bằng module ProView. Không đặt mục tiêu tái sử dụng nhiều dòng code nhất. Một component mới nhận DTO/ViewModel ProView rõ ràng tốt hơn lớp giả lập OpenReview Notes chỉ để giữ một container cũ.

Các nhận xét upstream dưới đây là quan sát từ source công khai, không phải kết quả build. Các lựa chọn triển khai là đề xuất cần được A00/A01/F00 ghi nhận trong ADR và xác nhận trên checkout đã pin.

## 2. Trạng thái khảo sát và nguồn đã kiểm tra

Đã đọc source bằng truy cập chỉ đọc trên GitHub/raw GitHub. **Chưa clone upstream; chưa biết commit SHA/tag chính xác; chưa cài dependency hoặc chạy upstream lint/test/build.** Không có SHA nào được phỏng đoán. Các URL `master` dưới đây có thể thay đổi; A01 phải thay bằng permalink chứa SHA trong tài liệu baseline thực tế.

| Quan sát                                                                                                                                                                         | Nguồn đã đọc                                                                                                                                                                                                                                                                                                | Hệ quả cho kế hoạch                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository là official web interface; README ghi React/Next.js và AGPL v3 hoặc later.                                                                                            | [README](https://github.com/openreview/openreview-web/blob/master/README.md), [LICENSE](https://raw.githubusercontent.com/openreview/openreview-web/master/LICENSE.md)                                                                                                                                      | Giữ provenance, notices, license và kế hoạch cung cấp corresponding source của bản dẫn xuất.                                                                      |
| `package.json` được truy cập ghi version `1.15.38`, Next `^15.5.25`, React `^19.0.0`; có Ant Design, Bootstrap, jQuery và Sass.                                                  | [package.json](https://raw.githubusercontent.com/openreview/openreview-web/master/package.json)                                                                                                                                                                                                             | Đây là dependency ranges quan sát được, không phải lock resolution đã xác minh. Giữ stack hiện tại trước, không nâng/migrate cả framework trong cùng bước import. |
| Scripts hiện dùng oxlint/oxfmt, Jest, TestCafe; README nêu Testing Library. TestCafe integration cần OpenReview API v1/v2. CONTRIBUTING có tên script khác với package hiện tại. | [package.json](https://raw.githubusercontent.com/openreview/openreview-web/master/package.json), [README](https://github.com/openreview/openreview-web/blob/master/README.md), [CONTRIBUTING](https://raw.githubusercontent.com/openreview/openreview-web/master/CONTRIBUTING.md)                           | Đọc script thực tế của pinned commit. Giữ baseline evidence riêng; acceptance ProView dùng Playwright và backend ProView thật.                                    |
| Thư mục `app/` chứa routes forum, submissions, profile, groups, invitations, public conference/research pages.                                                                   | [app tree](https://github.com/openreview/openreview-web/tree/master/app)                                                                                                                                                                                                                                    | Chốt route allowlist ProView và loại conference pages khỏi route graph. Ẩn menu chưa đủ.                                                                          |
| SSR auth kiểm tra JWT issuer bắt đầu `openreview` và `user.profile.id`; middleware/client refresh dùng `API_V2_URL/refreshToken`.                                                | [app/auth.js](https://raw.githubusercontent.com/openreview/openreview-web/master/app/auth.js), [middleware.js](https://raw.githubusercontent.com/openreview/openreview-web/master/middleware.js), [lib/clientAuth.js](https://raw.githubusercontent.com/openreview/openreview-web/master/lib/clientAuth.js) | Thay toàn bộ auth integration cùng cookie/session assumptions; không chỉ đổi base URL. Backend ProView phải xác minh token và quyền độc lập.                      |
| API client chứa dual-version Notes/Groups/Invitations, guest clearance, Turnstile và analytics error reporting.                                                                  | [lib/api-client.js](https://raw.githubusercontent.com/openreview/openreview-web/master/lib/api-client.js)                                                                                                                                                                                                   | Viết client ProView tách biệt, không giữ API compatibility layer v1/v2 OpenReview.                                                                                |
| `Forum.js` trực tiếp lấy Notes/Invitations, xử lý signatures/readers, Area Chair, sockets và jQuery.                                                                             | [components/forum/Forum.js](https://raw.githubusercontent.com/openreview/openreview-web/master/components/forum/Forum.js)                                                                                                                                                                                   | Dùng interaction/layout làm nền; thay orchestration bằng explicit ProView modules. Không mang generic forum engine vào domain backend.                            |
| `NoteEditor.js` dựng fields từ invitation schema, có reader/signature rules, localStorage drafts và post `/notes/edits`.                                                         | [components/NoteEditor.js](https://raw.githubusercontent.com/openreview/openreview-web/master/components/NoteEditor.js)                                                                                                                                                                                     | Review form cần rubric DTO, server draft persistence, version conflict và submit flow riêng. Không dùng localStorage như nguồn lưu draft chính.                   |
| `Note`/`ForumNote` phụ thuộc content wrappers, invitations, readers, signatures; `ForumNote` liên kết PDF theo `/pdf?id=noteId`.                                                 | [Note.js](https://raw.githubusercontent.com/openreview/openreview-web/master/components/Note.js), [ForumNote.js](https://raw.githubusercontent.com/openreview/openreview-web/master/components/forum/ForumNote.js)                                                                                          | Refactor presentation thành props trung lập; không cam kết có sẵn PDF viewer trung lập dùng nguyên trạng.                                                         |
| `DownloadPDFButton` gọi `/attachment` với Note IDs và hỗ trợ tải nhiều PDFs.                                                                                                     | [DownloadPDFButton.js](https://raw.githubusercontent.com/openreview/openreview-web/master/components/DownloadPDFButton.js)                                                                                                                                                                                  | Thay file transport/authorization; không mang bulk download vào archive student.                                                                                  |
| Submission route lấy venue group/submission invitation; profile route lấy `/profiles`, tags và vouch/service roles.                                                              | [submission page](https://raw.githubusercontent.com/openreview/openreview-web/master/app/submissions/page.js), [profile page](https://raw.githubusercontent.com/openreview/openreview-web/master/app/profile/page.js)                                                                                       | Phải thay server-page data orchestration, không chỉ component con. Profile ProView chỉ giữ thông tin được đặc tả yêu cầu và lịch sử project.                      |
| Root layout có `next/font/google`, GoogleAnalyticsScript và OpenReview metadata; forum metadata có PDF URL hardcode OpenReview.                                                  | [app/layout.js](https://raw.githubusercontent.com/openreview/openreview-web/master/app/layout.js), [app/forum/page.js](https://raw.githubusercontent.com/openreview/openreview-web/master/app/forum/page.js)                                                                                                | Offline gate phải xét font build-time, scripts/assets runtime, SSR fetch và metadata; không chỉ tìm ba hostname API.                                              |
| `Tabs.js` vừa có legacy Bootstrap `data-toggle` vừa có Ant Design wrapper.                                                                                                       | [Tabs.js](https://raw.githubusercontent.com/openreview/openreview-web/master/components/Tabs.js)                                                                                                                                                                                                            | Ưu tiên wrapper phù hợp; không thêm phụ thuộc global DOM/jQuery vào module mới.                                                                                   |

Danh sách component là ứng viên có căn cứ, chưa phải inventory cuối cùng. A01 phải khảo sát đầy đủ transitive imports, tests và behavior ở checkout thật trước khi chốt reuse.

## 3. A01 — Baseline upstream trước khi chuyển đổi

### Đầu vào và ownership

- Đầu vào: repository official, hai đặc tả và plan tổng thể.
- A01 sở hữu checkout khảo sát, import provenance và tài liệu upstream. Phối hợp A02 về vị trí `apps/web`, workspace/build configuration; chưa giao các agent tính năng sửa frontend ở bước này.
- Baseline cần URL, commit SHA đầy đủ, branch/tag nếu có, package version, thời điểm khảo sát, runtime/package-manager versions, checksum hoặc danh tính lockfile.

### Trình tự

1. Clone official repository; ghi `git rev-parse HEAD`, tag nếu commit có tag và license thực tế. Không lấy số version trong `package.json` làm commit identity.
2. Đọc README/LICENSE/CONTRIBUTING, package scripts/lockfile, routes, layout/providers, form/forum/submission/profile, client/auth, assets và test configuration.
3. Cài theo lockfile npm của pinned upstream, ưu tiên `npm ci` khi lockfile hợp lệ. Chạy các script thực tế có trong pinned commit trước khi chuyển package manager.
4. Lưu kết quả baseline lint, unit tests, build và feasible integration tests. Ghi rõ failure do environment/backend upstream thiếu, dependency, hay source; không ghi PASS cho test chưa chạy. Không dùng production OpenReview service để tạo dữ liệu thử.
5. Lập dependency map: active route → page/container → hooks/client/auth → external domains. Đặc biệt xét SSR metadata, middleware, sockets, scripts, webfields và global helpers.
6. Chốt inventory reuse/refactor/replace/remove với rationale và source permalink. Import nguồn vào `apps/web` sao cho phân biệt được imported baseline với thay đổi ProView.
7. **Sau baseline**, A02 phối hợp chuyển sang pnpm workspace, pin runtime/package manager, tạo một root lockfile tái lập được. Bảo toàn provenance của upstream lockfile trong Git/tài liệu; không để hai package manager cùng ghi active dependency graph.
8. Chạy lại checks phù hợp sau import/pnpm để tách lỗi migration khỏi lỗi domain adaptation. Đánh giá `next-build-id` nếu build phụ thuộc vị trí Git; không tạo version giả hoặc bỏ kiểm tra để build xanh.

### Deliverables bắt buộc khi implement

- `docs/upstream-openreview.md`: URL/SHA/tag/version/license, imported/reused/replaced files, modification log và nguồn các assets.
- `docs/openreview-adaptation.md`: architecture observations, conceptual mapping, route/dependency inventory, reuse decisions, runtime removal plan.
- `docs/evidence/upstream-baseline.md`: lệnh thật, môi trường, exit status, log và giới hạn khảo sát.
- Applicable license/notices trong source dẫn xuất; dấu vết sửa đổi rõ ràng. Link/source package phục vụ corresponding source phải trỏ tới bản triển khai tương ứng khi vận hành sau này.

Việc tách Next và Nest qua REST là ranh giới kỹ thuật; tài liệu không được tự kết luận rằng backend đương nhiên được miễn mọi nghĩa vụ license. A00 ghi rõ provenance và phạm vi phần mềm dẫn xuất, không xóa notice chỉ vì đã đổi branding.

## 4. Ma trận tái sử dụng đề xuất

| Upstream area                                                                                               | Quyết định dự kiến                       | Đích ProView / điều kiện                                                                                                          |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Next App Router, build structure, scoped styles                                                             | Giữ và thích nghi                        | `apps/web`; không Vite/React Router; TypeScript cho code mới.                                                                     |
| `Alert`, `Badge`, `LoadingSpinner`, `SpinnerButton`, `ErrorDisplay`, `PaginationLinks`, `Table`, `Collapse` | Candidate reuse                          | A01 kiểm tra transitive imports và accessibility; chỉ giữ leaf components không đòi API/global runtime ngoài ý muốn.              |
| `Tabs.js`                                                                                                   | Reuse/refactor có chọn lọc               | Ưu tiên API khai báo của AntD; kiểm keyboard/focus, bỏ thao tác DOM từ legacy tabs nếu không cần.                                 |
| `Note`, `NoteList`, `ForumNote`, version presentation                                                       | Refactor/copy phần nhỏ có attribution    | `SubmissionCard`, `SubmissionHeader`, `VersionHistory`, `ReviewCard`; props là ProView ViewModels.                                |
| `Forum`, filters/reply hierarchy                                                                            | Tách presentation, thay container        | `SubmissionWorkspace` và `DiscussionPanel`; explicit review/rebuttal/discussion types, không Invitations/reader regex/Area Chair. |
| `NoteEditor`, invitation/webfield form engine                                                               | Thay                                     | `RubricReviewForm`, `RebuttalForm`, `GradeForm`, typed schema; server save và optimistic concurrency.                             |
| PDF/download presentation                                                                                   | Reuse visual nếu phù hợp, thay transport | Authorized file endpoint/object URL, version binding, inline view và download theo policy. Không public storage key.              |
| Login/auth/client/middleware/useUser/OpenReview providers                                                   | Thay                                     | ProView session, local credentials, `/api/v1` transport và own account profile.                                                   |
| Profile/publications/import/expertise                                                                       | Chỉ giữ bố cục cần thiết                 | Name/email/password và own project history; bỏ research publication/import/service roles.                                         |
| Conference/venue/bidding/chair consoles                                                                     | Loại khỏi route và runtime imports       | Code chưa xóa chỉ được ở vùng không có active route/build dependency; không giữ trang conference để hỗ trợ workflow thường.       |
| Marketing/nav/metadata/analytics/Turnstile/Stripe                                                           | Thay hoặc loại                           | Authenticated ProView shell, brand tokens, local assets, legal/source information phù hợp.                                        |

Mỗi component được giữ cần một dòng inventory gồm path upstream, SHA, owner, loại sửa đổi, phụ thuộc còn lại và test. Tỷ lệ code reuse không phải acceptance criterion.

### Conceptual mapping

| OpenReview             | ProView                                                |
| ---------------------- | ------------------------------------------------------ |
| Venue                  | CourseOffering                                         |
| Paper / Note           | Project + Submission + SubmissionVersion, tùy màn hình |
| Authors                | ProjectGroup và historical membership                  |
| Reviewer               | Instructor hoặc peer ProjectGroup được assignment      |
| Review invitation/form | Rubric version + ReviewerAssignment                    |
| Review                 | Review và criterion scores/comments                    |
| Author response        | Rebuttal                                               |
| Forum                  | Submission workspace + scoped DiscussionMessage        |
| Decision               | Instructor Grade / final evaluation                    |
| Revision               | SubmissionVersion hoặc correction history phù hợp      |
| Profile                | ProView Student/Instructor profile                     |

Mapping chỉ để định hướng UX. Không sinh database Note/Invitation/Group tổng quát, không bọc API ProView thành OpenReview-shaped JSON.

## 5. UI system và routing

- Giữ style/component stack upstream phù hợp trong giai đoạn đầu. Không ép rewrite toàn bộ JS thành TS hay đưa thêm Tailwind/shadcn chỉ để khớp preference cũ. F00/A00 ghi ADR về component system; A02 đảm bảo lệnh lint/format/typecheck chung bao phủ code ProView và phần upstream còn được dùng.
- Dùng Navy `#0D1B3D`, accents `#1565E8`, `#3757F0`, `#584AF7`, `#7A3CFF` thành tokens. CSS modules cho phần mới để tránh global Bootstrap styles tác động ngoài ý muốn. Không đổi mọi màn hình bằng recolor đơn thuần.
- Responsive tối thiểu desktop/tablet/mobile; form labels, visible focus, keyboard navigation, semantic HTML, sufficient contrast. Final submit/publish/revoke cần confirmation rõ hậu quả; draft save có state và thông báo lỗi.
- Route taxonomy đề xuất: `/login`, `/dashboard`, `/courses`, `/offerings/[id]`, `/projects/[id]`, `/submissions/[id]`, `/reviews`, `/review-management`, `/grading`, `/similarity-checks`, `/archive`, `/notifications`, `/profile`, `/admin/*`. F00 chốt đường dẫn cuối cùng một lần theo API/context, feature agents không tự tạo navigation cạnh tranh.
- Student nav: Dashboard, Courses, My Project, Reviews, Archive, Notifications, Profile. Instructor: Dashboard, Courses, Review Management, Grading, Similarity Checks, Archive, Notifications, Profile. Admin: Dashboard, Users, Courses, Audit Logs.
- Layout/route gating hỗ trợ UX; backend quyết định quyền. Direct URL không được vượt guard. User nhiều role/context phải chọn được đúng offering, không suy ra quyền data chỉ từ menu.
- Loại public conference pages khỏi `app/` active. Không đặt code legacy đã cách ly trong Next route group vì route group vẫn có thể tạo route.

## 6. API, adapters, projections và session

Luồng dữ liệu chuẩn:

```text
NestJS guard + domain policy + audience serializer
  → OpenAPI DTO đã loại dữ liệu không được phép xem
  → lib/api/<domain>
  → lib/adapters/<domain>
  → lib/view-models/<domain>
  → components / feature containers
```

`packages/shared` chỉ chứa public/generated contract types, enum/error codes cần dùng; không export Prisma models hay domain services sang web. Adapter thuần chuyển hình dữ liệu, không tạo permission và không phải chỗ xóa identity đầu tiên.

| Boundary           | Quy ước phải đóng trước feature implementation                                                                                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client transport   | Browser cùng origin `/api/v1`; server client entrypoint riêng nếu cần. Một error envelope, cancellation, pagination/filter conventions và upload progress strategy.                                             |
| Auth               | Access token ngắn hạn trong memory; refresh cookie HttpOnly theo A04. Refresh single-flight, giới hạn retry, CSRF/origin contract theo backend. Không token trong URL/localStorage.                             |
| Session/cache      | Logout, đổi tài khoản, password reset/change hoặc session revoked phải clear private queries và auth state. Account deactivate bị backend từ chối dù UI chưa refresh.                                           |
| SSR/RSC            | Mặc định SSR shell nếu memory-token model không có safe server session. Khi SSR private data, forward đúng credential theo contract, `no-store`/request-scoped cache; không shared response giữa actor.         |
| Next server/client | Server-only secrets không xuất vào `next.config.env` hay `NEXT_PUBLIC_*`. Không global singleton giữ token của request trước. Không để raw instructor DTO vào props/RSC rồi client ẩn bớt.                      |
| Query keys         | Bao gồm user/session context và offering/resource context cần thiết; cache invalidation theo mutation. Anonymous vs instructor projections không chia sẻ cache object.                                          |
| ViewModels         | `ProjectSubmissionViewModel`, `ReviewViewModel`, `ReviewerAssignmentViewModel`, `RubricViewModel`, `RebuttalViewModel`, `CourseOfferingViewModel`, `GradeViewModel`.                                            |
| Identity           | Union anonymous `{ label }` và named `{ displayName, ...allowedFields }`; anonymous không chứa group/student/profile ID, email hay URL dẫn tới danh tính. Alias ổn định do backend cấp theo submission context. |
| Capabilities       | `allowedActions` giúp trạng thái nút/form; backend luôn kiểm tra lại, kể cả khi deadline trôi qua trong lúc mở trang.                                                                                           |
| Concurrent edits   | Draft review/rebuttal/grade có revision/ETag convention. `409` hiển thị stale-data state và cho tải bản mới; không silent overwrite.                                                                            |
| Private grades     | Student DTO không có draft grade; grade publish invalidate relevant caches sau backend success.                                                                                                                 |
| API failure        | Phân biệt validation, forbidden/not found, expired session, workflow conflict và storage unavailable. Lưu nội dung form khi recover được; không báo success nếu request fail.                                   |

Các feature API modules gồm auth, courses/offerings/groups, projects, submissions/files, assignments/conflicts, reviews/rubrics, rebuttals/discussions, grades, archive, similarityChecks, notifications và admin. F00 sở hữu client primitive/conventions; feature owner chỉ bổ sung module và adapter trong subtree được giao.

### File/PDF và offline

- File access phải đi qua backend policy cho đúng submission version, assignment và archive audience. Cả range requests/result attachments cũng cần authorization.
- Nếu viewer dùng blob/object URL thì tải bằng authorized client và revoke URL khi unmount/version đổi/logout; không để browser request trực tiếp public bucket. Không gắn bearer token vào URL.
- Inline viewer hiển thị version/status rõ ràng; download chỉ khi policy cho phép. Inline không phải DRM và không thể ngăn người xem lưu nội dung họ nhận được.
- Chọn viewer thực tế sau A01 spike; nếu dùng PDF.js, worker/assets phải được bundle hoặc host local. Không dùng external document-viewer service.
- Font cần system font hoặc font được vendored hợp lệ; thay `next/font/google` nếu build cần tải Google font. Cả **build và runtime** phải chạy không Internet sau khi dependencies/cache/images và assets cần thiết đã có.
- Loại runtime analytics/Turnstile/Stripe/public-research lookup; self-host asset thực sự cần. Nguồn/license links được phép trong attribution, không được tự fetch để vận hành core workflow.
- Playwright browser routing không thấy Next SSR/middleware fetch; Q00/Q01 cần egress restriction/recording ở server/container nữa. Allowlist phải gồm local Next/API/storage cần thiết và chặn hosts khác.

## 7. Central submission workspace

F02 sở hữu route container và layout của submission workspace. Đây là màn hình chung cho author, peer reviewer và instructor; module khác tích hợp bằng props/slots đã thống nhất, không nhân bản ba trang có nghiệp vụ lệch nhau.

```text
SubmissionWorkspace (F02 owner)
  header / course-stage / workflow / deadlines
  version selector / PDF viewer / version history
  review form + review display (F02)
  scoped discussion presentation (F02, dùng A09 contract)
  rebuttal panel (F03)
  grading panel + consolidated evidence (F03)
  similarity summary panel (F04)
```

- Author: group/project info, current version/history, visible released reviews, anonymous labels khi áp dụng, rebuttal/discussion theo quyền và published grade.
- Reviewer: **assigned version cố định**, rubric version, criterion scores/comments, strengths/weaknesses/overall/recommendation khi configured, server save draft, submit, COI action. Upload version mới không tự đổi tài liệu đang review.
- Instructor: real identities, assignment/COI status, all permitted reviews, rebuttal/discussion, similarity đúng version, grade draft/publish controls.
- Các panel tiêu thụ projection/capabilities phù hợp. Không fetch dữ liệu instructor rồi xóa khỏi DOM của author.
- Workspace handles loading/error/empty states ở từng panel để lỗi phụ không che PDF/primary action. Final mutations vẫn phải dùng backend transaction, không ghép nhiều client requests thành một hành động giả atomic.

## 8. Gói việc giao agent

### F00 — Shell, authentication và API foundation

**Dependency:** A01 baseline/import; A02 workspace; A00 contracts; A04 auth/policy. Có thể khảo sát shell sớm, nhưng chỉ DONE khi ProView auth thật đã tích hợp.

**Sở hữu:** root layout/navigation/theme/provider, auth frontend, API primitive, query configuration, shared ViewModel conventions, route registry. Chỉ F00 sửa các vùng này; dependency root/lockfile vẫn thuộc A02.

**Việc làm:** ProView branding; role/context navigation; login/logout/session recovery; client/error contracts; adapters convention; offline local assets; route isolation; empty/loading/forbidden/session-expired states. Thiết lập testing utilities và representative DTO fixtures với Q00.

**Acceptance:** local ProView account đăng nhập không redirect/call OpenReview; refresh/logout/revocation works; private cache sạch khi đổi account; unauthorized direct route bị chặn; migrated frontend build; legal/provenance preserved. Không có core login mock.

### F01 — Course, offering, roster, groups và setup

**Dependency:** F00 + A05 và các public DTO đã khóa.

**Sở hữu:** `features/courses`, `features/offerings`, `features/groups`, các route adapters tương ứng và API/adapters domain của chúng.

**Việc làm:** course catalog/offerings; create/copy configuration; stages, deadlines/timezone, anonymity, review count, rubric configuration và similarity requirement; roster add/remove/CSV preview + commit errors; create/manage group/members; project title/description/lifecycle view.

**Acceptance:** instructor setup hoàn chỉnh nối API; wrong-offering operations bị backend từ chối và UI xử lý; CSV lỗi không báo imported; membership khóa/history được phản ánh; datetime input/display đúng offering timezone; copy prior offering không copy roster/submissions trái contract.

### F02 — Submission, review, assignment/COI và central workspace

Tách thành ticket con để một agent không phải giữ mọi phần cùng lúc, nhưng **một owner duy nhất** giữ central container. F02a và F02b là các gói trong lịch tổng thể; F02b.1–F02b.3 dưới đây chỉ là subpackages nội bộ của F02b, không tạo thêm wave độc lập.

| Ticket | Sở hữu                                                       | Dependency / output                                                                                                                                                                    |
| ------ | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F02a   | Submission route/container, upload/viewer/version components | A06 + F00/F01: upload draft version, explicit submit, version history, fixed-version viewer.                                                                                           |
| F02b.1 | Review dashboard/form/cards                                  | A07/A08; author review view cần thêm release policy/contract tích hợp A09: assigned review list, rubric, server save/resume, final submit/locked/correction states và anonymity views. |
| F02b.2 | Instructor review-management/COI components                  | A07: manual/auto assignment preview/apply, workload, infeasibility reason, COI request/decision/reassignment và completion monitoring.                                                 |
| F02b.3 | Scoped discussion panel                                      | A09: submission/review discussion đúng audience; nhúng vào container qua component contract đã chốt.                                                                                   |

**Acceptance:** upload hai versions không làm mất file cũ; submit/pinned review đúng version; deadline/type/size/conflict errors rõ ràng; partial draft persistence thật; final review immutable; revoked assignment mất quyền file/review; COI/reassignment có trạng thái nhất quán. Author không nhận identity anonymous trong JSON/HTML/RSC/query cache/discussion; instructor hợp lệ luôn thấy identity thật.

### F03 — Rebuttal và consolidated grading

**Dependency:** F02 slots; A09 rebuttal/discussion; A11 grading và evidence từ A08/A10. Grade UI có thể viết theo contract trước, chưa DONE khi evidence thật thiếu.

**Sở hữu:** `features/rebuttals`, `features/grading`, domain API/adapters; bàn giao `RebuttalPanel` và `GradingPanel` cho F02 owner tích hợp, không tự sửa central route/layout.

**Việc làm:** general/per-review rebuttal, window/deadline/finalize/reopen; grading queue; consolidated evidence đúng version/rubric; overall/per-criterion score, feedback, draft và publish; stale edit recovery; required similarity state được giải thích.

**Acceptance:** group rebuttal save/finalize/expiry/reopen đúng backend state; submitted reviews/correction history hiển thị đúng; draft grade không tới student; publish kiểm prerequisites, audit/notification/backend success; không tự coi peer average là final grade. Instructor không phải chuyển qua nhiều trang để xem evidence cần chấm.

### F04 — Similarity, archive, dashboards, notifications và profile

**Dependency:** F00; A10 similarity, A12 archive, A13 notifications, A14 profile và các aggregate endpoints đã định nghĩa. Chia ticket theo module, không đánh dấu cả gói DONE khi chỉ có dashboard. F04a chứa mọi secondary workflow trừ archive; F04a.1–F04a.3 chỉ là subpackages nội bộ. F04b là archive theo lịch tổng thể.

| Ticket                          | Sở hữu / việc làm                                                                                                                        | Acceptance chính                                                                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| F04a.1 similarity               | Queue, report access, mark submitted externally, enter result/date/percentage/notes/PDF, FAILED/WAIVED reason; summary slot cho F02/F03. | Không gọi COOPY API; status gắn đúng final version; result attachment private; copy UI phân biệt similarity và plagiarism judgment.                 |
| F04b archive                    | Own historical projects và approved reference views; course/semester/title filters; instructor/admin student search; approve/revoke.     | Eligibility theo backend, offering closed/archived; no bulk download; revoke làm access-file thất bại; không copy project thành archive data riêng. |
| F04a.2 dashboards/notifications | Role dashboard cards/queues/deadlines; unread/read/pagination/deep links.                                                                | Aggregate numbers dùng data thật; URL/payload không leak identities; unavailable data không được biến thành số 0 giả.                               |
| F04a.3 profile                  | Name/email/password và own past-project history.                                                                                         | ProView account API; historical membership preserved; không profile/publication imports OpenReview; password/session behavior theo A04.             |

F04 owner không viết lại assignment/grading workflows bên trong dashboard. Cards link tới route owner đã có; counts lấy API aggregate hoặc documented efficient query strategy.

### F05 — Admin

**Dependency:** F00, A14 admin/users/courses và A13 audit.

**Sở hữu:** `features/admin`, admin route subtree, domain API/adapters. Shared course-catalog primitives dùng F01 contract; không fork hai course CRUD implementations.

**Việc làm:** Admin dashboard, users search/create/edit/activate/deactivate/role/reset password, course catalog controls, audit filters actor/action/entity/date và pagination.

**Acceptance:** admin permissions enforced bởi backend; reset/deactivate ảnh hưởng session đúng contract; audit chỉ đọc, không nút sửa/xóa; field validation và failure states; cross-role navigation/cache không lộ dữ liệu.

## 9. Phân quyền sửa file và tích hợp

1. F00 sở hữu common shell/client/provider/router contract. F01–F05 gửi patch request nếu cần đổi convention; không sửa đồng thời root layout/client để unblock feature.
2. F02 sở hữu central page composition; F03/F04 cung cấp panels và typed contracts, F02/integrator nối vào slots theo thứ tự.
3. A02 sở hữu package files/root lockfile/config; feature agent đề nghị dependency và rationale, không tự chạy install ghi lockfile cạnh tranh.
4. A03/A04 và module backend owners xử lý schema/policy changes. Frontend không thêm client-side exception cho lỗi permission/workflow.
5. DTO thay đổi cần cập nhật OpenAPI/generated types, adapters và relevant tests cùng một integration change; không thêm `any`/optional fallback để che contract drift.
6. Feature agent được dùng fixture trong component tests. DONE cần tích hợp real NestJS/PostgreSQL/storage; không runtime mock cho submission/review/grade/archive.
7. Mỗi handoff ghi paths, inherited upstream code, behavior, APIs/projections, test commands/results, remaining dependencies và known failures. Không ghi PASS nếu chỉ kiểm tra static markup.

## 10. Q00/Q01 — Kiểm thử và bằng chứng hoàn thành

Q00 dựng test/contract/privacy/network harness ngay từ baseline. Q01 chạy full acceptance trên production local sau khi các slices đã hợp nhất. Giữ Jest/Testing Library phù hợp để kiểm components/adapters; Playwright mới kiểm ProView workflows, không yêu cầu dựng lại hạ tầng conference chỉ để dùng nguyên bộ TestCafe upstream.

| Gate                  | Kiểm tra tối thiểu                                                                                                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline              | Exact SHA/runtime/lockfile và actual lint/unit/build outcomes; unsupported upstream E2E được ghi rõ.                                                                                      |
| Contract/component    | DTO-to-VM mapping; anonymous identity union; error/conflict states; rubric validation, version display, confirmation/focus/keyboard.                                                      |
| Auth                  | Local login; không OpenReview account; refresh single-flight; expired/revoked session; logout/account change clears private cache.                                                        |
| Navigation            | Role menus ProView; direct legacy/conference routes không hoạt động; metadata/favicon/title đúng brand.                                                                                   |
| Setup/submission      | Instructor setup → roster/groups → student PDF versions → explicit submit; viewer/file permission và range requests.                                                                      |
| Review/privacy        | Assignment/COI/reassignment, server draft/resume/submit, corrected review; NAMED vs ANONYMOUS_TO_AUTHORS; instructor identity; negative API/HTML/RSC/cache/notification/discussion tests. |
| Rebuttal/grading      | Release/window/deadline/finalize/reopen; consolidated evidence; grade draft private, publish visible đúng nhóm; stale revision và double mutation.                                        |
| Similarity/archive    | Manual COOPY states/result uploads; own history vs later-cohort reference access; approve/revoke; unauthorized file download blocked.                                                     |
| Secondary/admin       | Notifications read/deep link; dashboards real data; profile/password; admin users/courses/audit read-only.                                                                                |
| External dependency   | Source search + import/route graph review + browser request assertion + server/container egress test; no normal OpenReview requests, no hidden CDN/font/analytics dependency.             |
| Offline build/runtime | Dependencies/images/fonts/assets đã sẵn; build không cần remote font fetch; production Next/Nest và core workflow chạy khi chặn Internet.                                                 |
| Production            | Frontend/backend builds, clean database migration/seed, local production start, Playwright acceptance, screenshots/keyboard/mobile review, notices/source metadata.                       |

Anonymity test phải đọc payload thực tế, không chỉ assert reviewer name không hiện trên màn hình. Browser-only network assertions cũng không đủ chứng minh server không gọi OpenReview.

`rg` hostname/terminology cần allowlist attribution/docs/license có chủ đích; không xóa credit để đạt zero matches. Inventory cuối ghi conference code nào đã xóa, code nào vẫn tồn tại nhưng nằm ngoài route/import graph, và bằng chứng normal usage chỉ dùng ProView.

Frontend hoàn tất khi toàn bộ chức năng yêu cầu chạy với backend thật, production build và acceptance pass, provenance/license còn nguyên, source chuẩn bị cho bàn giao và không có runtime OpenReview dependency. Việc deploy bên ngoài vẫn nằm ngoài phạm vi.
