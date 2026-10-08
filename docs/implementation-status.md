# Trạng thái triển khai — 08/10/2026

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
3. Hoàn tất evidence CI cho revision timezone/lịch sử. Deadline và term dates hiện dùng timezone offering; generic audit/notification timestamps ghi rõ timezone trình duyệt. Kiểm thử DST gap/fold và browser UTC/offering New York đã bổ sung.
4. Format/drift/recovery đã PASS cả native và S3 trong [CI8563118](https://github.com/kongwoang/ProView/actions/runs/37752007606):39 bảng/21 PDF được khôi phục và đối chiếu, cùng các negative checks. Host không có Docker hoặc `pg_dump`/`pg_restore`; đây là kết quả thực ở GitHub Actions, không suy diễn từ unit test.

## Công việc operator trước deployment ngoài máy local

Không deploy theo scope hiện tại. TLS, production secrets, backup scheduling/retention/recovery trên host thực và representative load thuộc deployment checklist. Chỉ cần centralized rate limiting khi vận hành nhiều API replicas. Thủ tục và diễn tập phục hồi trong repository được mô tả ở `backup-recovery.md`.

Kết quả chạy thực và CI đã xác minh nằm ở [implementation-verification.md](evidence/implementation-verification.md); [testing.md](testing.md) chỉ tới suites. Không đóng Q00/Q01 chỉ vì core demo chạy được.
