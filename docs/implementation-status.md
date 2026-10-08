# Trạng thái triển khai — 09/10/2026

Chỉ một agent thực hiện các gói tuần tự theo yêu cầu hiện tại. Các package là scope đối chiếu, không phải subagent đang chạy. `IMPLEMENTED` nghĩa là core flow đã tích hợp và có bằng chứng được liệt kê; không khẳng định mọi tiêu chí thiết kế hoặc mọi assertion AD/S đã PASS. Q00/Q01 còn mở cho các phần thiếu dưới đây.

| Package | Trạng thái thực tế                     | Code và bằng chứng                                                                                                                               |
| ------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| A00     | IN_PROGRESS                            | ADR, architecture/policy/workflow; OpenAPI response coverage16/89; generated types/drift đã bổ sung                                              |
| A01     | IMPLEMENTED                            | `upstream-openreview.md`, baseline evidence; upstream commit/license pin và lịch sử import                                                       |
| A02     | IMPLEMENTED; đang mở rộng verification | pnpm workspace, Docker/Compose/Nginx, native/container CI; format/drift/recovery thêm vào CI                                                     |
| A03     | IMPLEMENTED                            | Prisma schema, hai migrations, real seed/bootstrap;17 rejection checks + exact-version fixture                                                   |
| A04     | IMPLEMENTED                            | Auth/policy/session; real HTTP rotation/replay/revocation, actor/offering boundaries; client race tests                                          |
| A05     | IMPLEMENTED                            | Courses/offering/CSV/groups/rubric; courses HTTP + E01/E09 lifecycle                                                                             |
| A06     | IMPLEMENTED                            | Private local/S3 PDFs, immutable versions, submit/reopen; HTTP checksums/Range/concurrency + E02                                                 |
| A07     | IMPLEMENTED                            | Assignment solver/oracle, preview/apply, COI/replacement; HTTP + E03/E04                                                                         |
| A08     | IMPLEMENTED                            | Collaborative review, anonymous presenters, correction history; HTTP + E05                                                                       |
| A09     | IMPLEMENTED                            | Rebuttal snapshots/finalize/reopen, discussion/release; HTTP + E06                                                                               |
| A10     | IMPLEMENTED                            | Manual similarity states/result files; exact-version HTTP + E07                                                                                  |
| A11     | IMPLEMENTED                            | Criterion scoring, consolidated evidence, exact grade publication; row-lock regression + E08                                                     |
| A12     | IMPLEMENTED                            | Own history, later cohort eligibility, approve/revoke private references; HTTP + E09/E10                                                         |
| A13     | IMPLEMENTED                            | Transactional audit/outbox, leases/reminders/dedup; actual PostgreSQL review integration                                                         |
| A14     | IMPLEMENTED                            | User administration, protected bootstrap, profile/password; HTTP/bootstrap tests                                                                 |
| F00     | IMPLEMENTED                            | Next shell, session/client/query isolation, source/license, user PNG/Montserrat; focused browser tests                                           |
| F01     | IMPLEMENTED                            | Setup/course/project screens; E01/E02/E09                                                                                                        |
| F02     | IMPLEMENTED                            | Versions/PDF/assignment/COI/review/discussion; focused tests + E02–E05                                                                           |
| F03     | IMPLEMENTED                            | Rebuttal/grading panels; E06/E08                                                                                                                 |
| F04     | IMPLEMENTED                            | Dashboards/similarity/archive/notification/profile; focused tests + E07/E09                                                                      |
| F05     | IMPLEMENTED                            | Admin users/courses/audit screens; role-navigation browser + backend authorization                                                               |
| Q00     | IN_PROGRESS                            | Actual HTTP/PostgreSQL/Chromium harness; E01–E10 mapped; broader AD/S assertion coverage still incomplete                                        |
| Q01     | IN_PROGRESS                            | Clean database/production build/native/container/offline checks; formatter, contract drift and recovery rehearsals added; remaining checks below |

## Phần tiếp tục bắt buộc trong repository

1. Hoàn thiện success-response DTO/schema cho73/89 operations còn thiếu, đặc biệt projection review/rebuttal/grade theo audience; chuyển các domain views còn viết tay sang generated contracts. Hiện không dùng kiểu tự suy đoán raw Prisma để lấp coverage.
2. Đối chiếu từng assertion AD01–AD11/S01–S10 và bổ sung test cho phần chưa có bằng chứng: phân tích chi tiết SSR/cache/notifications, payload XSS/log hygiene, failure compensation, auth rate-limit và các concurrency matrix còn thiếu. Test nhóm hiện có không tự chứng minh toàn bộ từng hàng.

Đã xác minh: [CI8563118](https://github.com/kongwoang/ProView/actions/runs/37752007606) và [CI3cb69bf](https://github.com/kongwoang/ProView/actions/runs/37753989428) đều PASS cả native/container. Format/drift,28 unit tests, real HTTP/PostgreSQL,7 Chromium tests và recovery local/S3 đều đã chạy thật. Recovery đối chiếu39 bảng/21 PDF và các negative checks. Deadline/term inputs dùng timezone offering; generic audit/notification timestamps ghi rõ timezone trình duyệt. DST gap/fold và browser UTC/offering New York đã được kiểm thử. Profile phân trang và tìm nguồn copy độc lập đã tích hợp. Host thiếu PostgreSQL client tools/Docker nên recovery thực chạy ở GitHub Actions, không suy diễn từ unit test.

## Công việc operator trước deployment ngoài máy local

Deployment native trên host đã có Cloudflare DNS/Tunnel và HTTPS tại `proview.hoangpc.io.vn`. Admin thật đã tạo; login/refresh/logout, replay protection và source download qua domain thật đã kiểm tra. Backup đã xác minh và có bản sao riêng trên Mac; lịch backup/retention vẫn thủ công. Populated recovery và vòng đời học vụ đã chạy trên môi trường test riêng; PDF/workflow qua public domain và sustained load vẫn cần bằng chứng riêng. Chỉ cần centralized rate limiting khi vận hành nhiều API replicas. Xem [bằng chứng public deployment](evidence/public-deployment.md) và `backup-recovery.md`.

Kết quả chạy thực và CI đã xác minh nằm ở [implementation-verification.md](evidence/implementation-verification.md); [testing.md](testing.md) chỉ tới suites. Không đóng Q00/Q01 chỉ vì core demo chạy được.

## UI adjustment requested on 2026-10-08

The frontend now follows familiar OpenReview presentation: top navigation, centered content, flat lists, bordered tabs and plain forms, while preserving the supplied ProView logo/font and all domain workflows. The login explains administrator-created access; the admin overview shows management tools. See [adaptation decisions](openreview-adaptation.md) and [verification evidence](evidence/implementation-verification.md). This presentation change does not close the remaining response-schema and AD/S assertion-level evidence work above.

Follow-up UI clarification: preserve ProView navy/blue/purple while matching OpenReview's actual Noto Sans, spacing, title-first lists, square inputs, compact count links and two-tier footer. The authenticated header uses real course/user search, verified against the API. All seven native browser checks pass after the320px footer fix. Inspection of any user-provided OpenReview session is read-only.

## Native server preparation requested on 2026-10-08

The initial native preparation on `ServerThayQuang` kept all application-owned files beneath `/media/data3/users/longnd/ProView`, without root. Local Node/PostgreSQL/Caddy and a private tmux supervisor passed readiness, SSH-disconnect survival, child restart, graceful stop/start and empty-database backup/restore checks. Public Cloudflare DNS/Tunnel, administrator provisioning and HTTPS were completed afterward; see [native deployment](native-deployment.md) and [public evidence](evidence/public-deployment.md). Public PDF/lifecycle validation, scheduled independent backup retention and the remaining contract/AD/S plan gaps remain open. Boot startup is manual to respect the directory-only requirement.

The user requested comprehensive verification before DNS. Actual host tests include internal production-mode HTTPS/browser flows,62 proxy/security assertions, a disposable PostgreSQL crash/restart, log rotation,120 read requests at concurrency10 and recovery of39 tables/33 PDFs. Production data remained unchanged during that rehearsal. [Pre-DNS report](evidence/pre-dns-server-verification.md) records those exact results. Public activation and accessible frontend source distribution are now recorded separately in [public deployment evidence](evidence/public-deployment.md); neither report certifies all remaining AD/S assertions.
