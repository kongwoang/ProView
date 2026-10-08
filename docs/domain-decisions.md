# ProView — Quyết định domain, dữ liệu, workflow và API

Ngày lập: 07/10/2026; cập nhật: 08/10/2026. Các quyết định cốt lõi đã được áp dụng; xem [ADR triển khai](adr/0001-local-pilot.md), [workflow thực tế](workflow.md) và [trạng thái nghiệm thu](implementation-status.md). Các bảng thiết kế bên dưới vẫn cần đối chiếu code khi dùng làm hợp đồng, đặc biệt route/DTO và những tiêu chí chưa có bằng chứng.

Tài liệu này bổ sung [kế hoạch triển khai](implementation-plan.md). Hai đặc tả trong `docs/specifications/` là nguồn yêu cầu; phần OpenReview chỉ thay cách xây frontend, không thay domain quan hệ của ProView. Đây là tài liệu repository, không phải mô tả một hệ thống đã hoạt động.

A00 phải chốt các quyết định dưới đây thành ADR trước khi giao module phụ thuộc. A03 sở hữu schema và migration; A04 sở hữu policy framework; module owner gửi thay đổi contract cho A00/A03 thay vì sửa schema cạnh tranh. Các task ID sử dụng đúng hệ ID A00–A14, F00–F05, Q00–Q01 trong kế hoạch tổng.

## 1. Ranh giới nghiệp vụ

- NestJS là nơi duy nhất quyết định quyền, deadline, state transition, điểm, COI và archive eligibility. Frontend có thể hiển thị `allowedActions`, nhưng mọi mutation vẫn kiểm tra lại ở backend.
- `Course` là môn trong catalog; `CourseOffering` là một lần mở môn theo kỳ học. Instructor role toàn cục không tự cấp quyền quản lý mọi offering.
- Một `ProjectGroup` sở hữu một `Project`. Một project có một logical `Submission` cho mỗi `SubmissionStage`; stage là cấu hình, submission là đối tượng có lifecycle.
- File, version và evidence đã chốt không bị overwrite. Không có bảng ProposalSubmission/FinalSubmission, không có Note/Invitation của OpenReview và không có API COOPY giả định.
- Review nhóm là một bản cộng tác của nhóm reviewer, có người thực tế submit. Không tạo một review độc lập cho từng thành viên nhóm.
- Discussion chỉ tồn tại trong submission/review context. Không bổ sung chat tổng quát, public enrollment, realtime editor hoặc microservice.

## 2. Quan hệ và trường cần chốt

Tên trường dưới đây là contract thiết kế đề xuất. A03 có thể chuẩn hóa tên trong schema, nhưng phải bảo toàn ý nghĩa và cập nhật DTO/test tương ứng.

| Aggregate/entity                 | Quan hệ, dữ liệu trọng yếu                                                                                                                                                                          | Chủ sở hữu |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| User                             | UUID; username/email đã chuẩn hóa; display name; password hash; global role; active flag. Không trả password/session fields trong DTO.                                                              | A04/A14    |
| AuthSession                      | User; refresh token hash; token family/session; expiresAt; revokedAt; rotation lineage; thông tin client tối thiểu.                                                                                 | A04        |
| Course                           | Unique course code; title; active flag; nhiều offerings. Catalog record có lịch sử sử dụng không bị xóa vật lý tùy tiện.                                                                            | A05/A14    |
| CourseOffering                   | Course; semester label; academic year; termStartAt/termEndAt có thể so sánh; timezone; status; anonymity mode; workflow configuration. Instructor được xác định qua membership.                     | A05        |
| CourseMembership                 | User + offering + role INSTRUCTOR/STUDENT; joinedAt/endedAt. Giữ lịch sử khi đã có dữ liệu học thuật.                                                                                               | A05        |
| ProjectGroup                     | Offering; name; membershipLockedAt; một Project.                                                                                                                                                    | A05        |
| GroupMember                      | Group + student membership; joinedAt/leftAt; provenance khi instructor điều chỉnh đặc biệt.                                                                                                         | A05        |
| Project                          | Unique group; title; description. Offering suy ra qua group; nếu lặp offeringId để khóa constraint phải dùng composite FK bảo đảm nhất quán.                                                        | A05        |
| SubmissionStage                  | Offering; name; sequence; openAt; deadlines; allowReviews; allowRebuttal; requireSimilarityCheck; peer review count; rubric revision. Generic stage không phụ thuộc tên Proposal/Final Report.      | A05        |
| Rubric/RubricRevision            | Tên/mô tả; revision bất biến khi đã được dùng; tập criteria; recommendation configuration nếu dùng. Copy offering clone cấu hình rubric, không liên kết nhầm rubric editable của offering cũ.       | A05        |
| RubricCriterion                  | Rubric revision; title/description; weight; scoreMin/scoreMax; order. Criteria score tham chiếu đúng criterion của revision đã pin.                                                                 | A05        |
| Submission                       | Project + stage; status; latestDraftVersionId; submittedVersionId; reviewCycle; reviewsReleasedAt; workflow revision. Không dùng một `currentVersion` mơ hồ cho cả draft và bản nộp.                | A06        |
| SubmissionVersion                | Submission; versionNumber; uploader; uploadedAt; changeNote; immutable content metadata. Một version chỉ trở thành bản nộp khi command submit chọn nó.                                              | A06        |
| SubmissionFile                   | Version; sanitized display filename; MIME/extension; size; SHA-256; private storage key; persistence state. MVP một PDF chính cho mỗi version.                                                      | A06        |
| ReviewerAssignment               | Submission + exact version + reviewCycle; reviewer type; reviewer group XOR instructor user; status; predecessor/replacement linkage; rubric revision.                                              | A07        |
| ConflictOfInterestDeclaration    | Assignment; declaredBy; reason; PENDING/APPROVED/REJECTED; decidedBy/decisionAt/decisionNote; prior assignment status để khôi phục khi rejected.                                                    | A07        |
| Review                           | Assignment; exact version; pinned rubric; DRAFT/SUBMITTED; actual submitter; overall comments/strengths/weaknesses/recommendation; timestamps; optimistic revision.                                 | A08        |
| ReviewCriterionResponse          | Review + rubric criterion; score; criterion comment. Submit yêu cầu đủ criteria bắt buộc, score đúng miền.                                                                                          | A08        |
| ReviewRevision/correction record | Bản đã submit bất biến; correction giữ bản cũ, người cấp phép, lý do và submitter bản mới. Không dùng endpoint update thông thường để sửa bản đã chốt.                                              | A08        |
| Rebuttal                         | Một logical rebuttal cho submission và reviewCycle hiện hành; general response; DRAFT/FINALIZED; author/group; finalizedAt; reopenUntil; optimistic revision. Vòng cũ giữ lịch sử.                  | A09        |
| RebuttalReviewResponse           | Rebuttal + review thuộc cùng submission/cycle; nội dung. Không nhận reviewId thuộc submission khác.                                                                                                 | A09        |
| DiscussionMessage                | Submission bắt buộc; reviewId tùy chọn cùng context; real author lưu nội bộ; content; createdAt. Audience presenter quyết định identity ngoài API.                                                  | A09        |
| SimilarityCheck                  | Exact submission version; trạng thái; percentage nullable; resultDate; notes; external-submitted timestamp; reason khi failed/waived; result PDF tùy chọn.                                          | A10        |
| Grade/GradeRevision              | Logical grade cho submission; draft và published revision; exact version; pinned rubric; scores; feedback; overall override reason; grader/publisher. Published revision được giữ khi cần chấm lại. | A11        |
| GradeCriterionScore              | Grade revision + rubric criterion; Decimal score trong miền.                                                                                                                                        | A11        |
| ArchivePublication               | Project + submission version được duyệt; approvedBy/approvedAt; revokedAt/revokedBy/reason; allowDownload; scope cùng Course. Không copy project hoặc file.                                         | A12        |
| Notification                     | Recipient; type/title/body/target URL; readAt; createdAt; deduplication key. Payload đã được xử lý theo audience.                                                                                   | A13        |
| AuditLog                         | Actor hoặc SYSTEM; action; entity type/id; timestamp; request correlation; metadata allowlist. Không có API sửa/xóa thông thường.                                                                   | A13        |
| OutboxEvent/job                  | Event payload tối thiểu; idempotency key; processing lease/retry; processedAt. Cùng PostgreSQL và backend scheduler, không yêu cầu message broker.                                                  | A13        |

`reviewCycle` là số vòng nội bộ để phân biệt evidence trước/sau instructor reopen. Đây không phải hệ thống workflow tổng quát kiểu OpenReview. Một số vòng và lineage đã đủ cho MVP; chỉ tách entity ReviewRound nếu A03 chứng minh cần cho constraint/query cụ thể.

Quy ước versioned record như rubric/review/grade không bắt buộc ba module có cùng schema implementation. Điều bắt buộc là evidence cũ vẫn đọc được đúng nội dung đã chốt, và pointer hiện hành không làm thay đổi lịch sử.

## 3. Constraint, index và lịch sử

### 3.1 Constraint bắt buộc

| Invariant                                        | Cách bảo vệ đề xuất                                                                                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| User không trùng email/username sau chuẩn hóa    | Unique normalized key; quy tắc chuẩn hóa thống nhất import/login/admin.                                                                    |
| Một project cho mỗi group                        | Unique Project.groupId.                                                                                                                    |
| Một logical submission cho project × stage       | Unique `(projectId, stageId)`; kiểm tra cùng offering.                                                                                     |
| Version number không trùng trong submission      | Unique `(submissionId, versionNumber)` + transaction cấp số.                                                                               |
| Version pointer thuộc đúng submission            | Composite FK nếu phù hợp hoặc transaction invariant + integration test; không chỉ FK tồn tại UUID.                                         |
| Một active group mỗi student × offering          | Partial unique index với active membership; offeringId dùng cho constraint phải được khóa bằng composite FK với group/membership.          |
| GroupMember là student đúng offering             | Composite FK/unique composite keys và domain validation; không chỉ kiểm tra global STUDENT.                                                |
| Assignment chỉ có một reviewer target            | CHECK theo type: group XOR instructor user.                                                                                                |
| Không duplicate reviewer target trong cùng vòng  | Partial unique index cho active assignment theo submission/cycle/target; history không bị xóa. Approved COI pair vẫn bị loại khỏi vòng đó. |
| Assignment, review, version, rubric cùng context | Composite keys nơi khả thi, service guard và transaction tests cho toàn bộ đường ghi.                                                      |
| Một review logical cho assignment                | Unique assignmentId; correction qua revision.                                                                                              |
| Một response cho criterion                       | Unique `(reviewRevisionId, criterionId)`; tương tự grade revision.                                                                         |
| Một rebuttal logical trong vòng                  | Unique `(submissionId, reviewCycle)`; response review-specific unique theo rebuttal/review.                                                |
| Một logical similarity check mỗi version         | Unique submissionVersionId; retry giữ cùng check và ghi attempt/audit, không overwrite evidence completed.                                 |
| Một logical grade mỗi submission                 | Unique submissionId; mỗi revision pin version/rubric riêng.                                                                                |
| Điểm/check percent hợp lệ                        | CHECK cho percentage `[0,100]` hoặc null; criterion `scoreMax > scoreMin`, weight không âm; cross-row rubric checks ở publish service.     |
| Thứ tự stage/criterion rõ ràng                   | Unique `(offeringId, sequence)`; criterion order unique trong rubric revision.                                                             |

Không thể dùng CHECK đơn giản để kiểm tra dữ liệu bảng khác. A03 phải ghi rõ invariant nào DB bảo vệ, invariant nào cần service transaction, và test cho cả đường ghi admin/import/seed. Prisma schema không diễn đạt đủ partial index/CHECK thì migration SQL bổ sung, không bỏ constraint để dễ sinh schema.

### 3.2 Index/query và xóa dữ liệu

- Index các FK; các truy vấn phổ biến gồm membership theo user/offering, submissions theo stage/status, assignments theo reviewer/status/deadline, COI pending, similarity status, unread notifications, audit actor/action/entity/time.
- Search title/course/semester và pagination theo allowlist. Student search trong archive chỉ instructor/admin có policy phù hợp; không xây API public để liệt kê student.
- Dùng UUID cho entity id; có createdAt/updatedAt nơi phù hợp. Immutable record vẫn có timestamp sự kiện rõ, không cần giả vờ luôn cập nhật.
- Không cascade-delete submissions/reviews/grades/audit khi deactivate user hoặc đóng offering. Course/group đang được tham chiếu chuyển trạng thái hoặc bị từ chối xóa.
- Membership freeze từ **lần submit đầu tiên** của group/project. Lịch sử joinedAt/leftAt luôn được giữ.
- Instructor exceptional membership correction cần lý do, audit, recheck COI và không viết lại tác giả/uploader/submitter lịch sử. Student đã rời nhóm trước lần nộp không mặc nhiên thành tác giả của các version được nộp sau đó; owner history phải xét khoảng membership tại lần nộp hoặc snapshot tác giả tương đương.
- Own past projects phải truy được qua historical participation dù offering membership hiện tại đã kết thúc. Account bị deactivate vẫn bị chặn authentication như bình thường.

## 4. Cấu hình, thời gian và copy offering

Lưu tất cả instant UTC; `CourseOffering.timezone` là IANA timezone dùng nhập/hiển thị. Server Clock là nguồn quyết định; client countdown chỉ hỗ trợ UX. Deadline dùng điều kiện `now < deadline`: bằng deadline nghĩa là đã đóng.

- `openAt < submissionDeadline`; nếu bật review thì có reviewDeadline không sớm hơn submissionDeadline; nếu bật rebuttal thì có rebuttalDeadline không sớm hơn reviewDeadline. A00 có thể yêu cầu strictly increasing để tránh zero-length window; mặc định nên dùng strictly increasing cho các cửa sổ bật.
- `allowRebuttal=true` bắt buộc `allowReviews=true`. Khi review tắt, peer count bằng 0 và các deadline review/rebuttal không được dùng làm gate.
- Cấu hình deadline/rubric/anonymity có revision; thay đổi sau khi có dữ liệu cần policy và audit. Không sửa rubric đã được dùng hoặc giảm deadline âm thầm để khóa một hoạt động đang diễn ra.
- `termStartAt/termEndAt` phục vụ so sánh kỳ học; semester/academicYear vẫn là label cho người dùng. Same-course later cohort được xét theo mốc này, không sort lexicographic.
- Copy offering tạo mới stages, dates cần xác nhận, review/anonymity/similarity settings và rubric revisions. Không copy roster, group, project, file, assignment, review, rebuttal, similarity, grade, notifications hoặc publication.
- Offering mới là DRAFT. Activate yêu cầu cấu hình hợp lệ. CLOSED dừng mutation học thuật thông thường; ARCHIVED không làm report tự public.

| Offering transition | Actor/guard                                              | Side effect                                                                                                                         |
| ------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| DRAFT → ACTIVE      | Instructor quản lý; cấu hình và stage dates hợp lệ       | Audit, readiness summary.                                                                                                           |
| ACTIVE → CLOSED     | Instructor quản lý; hiển thị unresolved work trước close | Audit; khóa học thuật. Nếu phải bỏ qua incomplete work, command cần lý do và liệt kê items bị ảnh hưởng; không giả thành completed. |
| CLOSED → ARCHIVED   | Instructor/admin có policy; không có live editing        | Audit; dữ liệu/reference policy được giữ.                                                                                           |
| CLOSED → ACTIVE     | Exceptional reopen của instructor có quyền, lý do rõ     | Revoke/suspend publication đang dựa vào trạng thái closed; audit; không tự reopen mọi submission.                                   |

Không mặc định cho student mở lại offering hoặc unarchive. Nếu cần thêm transition, A00 cập nhật bảng guard/test trước implementation.

## 5. Submission và evidence lifecycle

### 5.1 Upload, submit, pin

1. Upload PDF tạo version và file metadata mới; chưa làm submission thành SUBMITTED, chưa tạo similarity check, chưa phát review assignment.
2. Student chọn version có file READY để submit. Backend kiểm membership, offering active, stage open, deadline, PDF thực tế, size/type/signature/checksum và ownership.
3. Submit đặt `submittedVersionId`, ghi actor/time; lần đầu khóa group membership. Stage requireSimilarityCheck tạo PENDING cho version được chọn trong cùng transaction ghi intent.
4. Resubmit trước deadline được phép khi chưa bắt đầu review và submission chưa finalized. Bản cũ giữ nguyên; check của bản cũ không chuyển sang bản mới.
5. Assignment apply hoặc instructor open-review command bắt đầu review, pin exact version/rubric/cycle và chuyển UNDER_REVIEW. Không có assignment đang hoạt động nhưng student vẫn có thể đổi bản được assignment dùng.
6. Stage không review không có assignment; đóng submission window hoặc instructor finalize-input command khóa version và chuyển REVIEW_COMPLETED. Tiếp đó có thể FINALIZED.

MIME từ client không đủ: extension, media type, header/signature và khả năng xử lý PDF tối thiểu phải thống nhất. Storage key ngẫu nhiên, filename chỉ dùng hiển thị sau sanitize. Không expose bucket/key hoặc token qua URL.

### 5.2 State machine

| From → To                        | Command/actor                                | Guard chính                                                                               | Side effect                                                                             |
| -------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| DRAFT → SUBMITTED                | Submit, author group                         | Window mở; version READY thuộc submission; roster/group hợp lệ                            | Pin submittedVersion; freeze membership; audit; similarity PENDING nếu yêu cầu.         |
| SUBMITTED → SUBMITTED            | Resubmit, author group                       | Chưa review/input lock; trước hạn                                                         | Đổi pointer có audit; giữ version/check cũ; tạo check đúng version mới.                 |
| SUBMITTED → UNDER_REVIEW         | Assignment apply/open review, instructor     | Reviews enabled; submitted version tồn tại; assignment plan hợp lệ                        | Pin evidence; tạo active assignments; notifications.                                    |
| SUBMITTED → REVIEW_COMPLETED     | Close input, instructor/scheduler            | Reviews disabled; hết hạn hoặc explicit early-close có audit                              | Khóa input version; bỏ qua review/rebuttal.                                             |
| UNDER_REVIEW → REBUTTAL_OPEN     | Release batch, instructor hoặc guarded job   | Đủ required submitted reviews hoặc instructor audited close; rebuttal enabled; còn window | Release cả batch; create/open rebuttal; notify authors.                                 |
| UNDER_REVIEW → REVIEW_COMPLETED  | Release/close review, instructor/job         | Rebuttal disabled, hoặc explicit waived/expired resolution có audit                       | Release hợp lệ; ghi lý do không có rebuttal window.                                     |
| REBUTTAL_OPEN → REVIEW_COMPLETED | Finalize rebuttal, author; hoặc deadline job | Finalization hợp lệ hoặc deadline đã qua                                                  | Khóa rebuttal; giữ draft nếu chưa finalize và đánh dấu expired, không giả là submitted. |
| REVIEW_COMPLETED → FINALIZED     | Finalize, instructor/guarded job             | Version/evidence vòng hiện hành đã khóa; không còn review/rebuttal mutation bình thường   | Audit; ready for final grading/archive theo gate riêng.                                 |
| Locked state → SUBMITTED         | Full submission reopen, instructor           | Lý do; deadline mới; preview ảnh hưởng; chưa mutation concurrent                          | Vòng review mới, xử lý evidence như mục 5.3.                                            |

Similarity và grade có state machine riêng. FINALIZED chỉ nói vòng submission/review/rebuttal đã chốt; không tự đồng nghĩa similarity completed hoặc grade published. Publish grade cho stage yêu cầu similarity vẫn phải kiểm gate đúng version ở mục 9.

Release review là một batch của current cycle, không release từng review ngay khi reviewer submit. Đủ review nghĩa là đủ số peer review cấu hình và tất cả instructor assignments bắt buộc đã submit; các assignment canceled/reassigned không được đếm. A07/A08 phải chốt cách đánh dấu mandatory assignment trước implementation.

Nếu review trễ làm rebuttal window đã hết, instructor phải mở hạn mới hoặc đóng/waive với lý do. Không tự cho rằng tác giả đã được rebuttal chỉ vì thời gian đã trôi qua.

### 5.3 Reopen có kiểm soát

Không dùng một generic PATCH status cho mọi tình huống:

- **Reopen rebuttal:** giữ version/reviews/cycle, cấp `reopenUntil` và lý do; policy dùng effective deadline. Nếu grade đã publish, instructor phải xác nhận đây là evidence bổ sung và chọn regrade theo command riêng; không tự sửa điểm.
- **Review correction:** giữ assigned version, giữ original submitted review, mở correction revision có hạn; không khởi động lại cả submission. Khi correction đã release, thông báo tác giả và bảo toàn original.
- **Full submission reopen:** cho phép thay PDF sau khi đã khóa, nên tăng reviewCycle. Active assignments cũ mất quyền hành động, submitted review/rebuttal/grade vẫn còn lịch sử nhưng được đánh dấu superseded đối với cycle hiện hành. Không tự chuyển review sang PDF mới.
- Full reopen bỏ current published-grade pointer hoặc đánh dấu published revision cũ superseded trong giao diện; giữ lịch sử đã công bố. Archive publication hiện hành bị revoke cùng transaction vì chưa có approval cho version mới.
- Similarity result cũ giữ nguyên trên version cũ. Khi submit PDF mới, tạo/check PENDING của version mới. Muốn dùng lại check cho cùng exact version phải là lựa chọn có audit, không copy percent sang version khác.
- Instructor nhìn thấy impact preview trước command; execution kiểm lại optimistic revision. Student không có quyền trigger reopen hoặc sửa pinned evidence.

## 6. Assignment và COI

### 6.1 State và access

| From → To                             | Trigger                            | Kết quả                                                                               |
| ------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------- |
| ASSIGNED → IN_PROGRESS                | Reviewer lưu draft đầu tiên        | Một review draft chung cho nhóm.                                                      |
| ASSIGNED/IN_PROGRESS → SUBMITTED      | Reviewer submit đủ rubric          | Review immutable; actual submitter lưu thật.                                          |
| ASSIGNED/IN_PROGRESS → COI_REQUESTED  | Reviewer khai báo reason           | Pause draft submit/file access thông thường theo policy; staff vẫn xem được evidence. |
| COI_REQUESTED → trạng thái trước đó   | Instructor reject có note          | Re-enable assignment; audit + notification.                                           |
| COI_REQUESTED → REASSIGNMENT_APPROVED | Instructor approve                 | Thu hồi quyền assignment cũ ngay; giữ lịch sử kín.                                    |
| REASSIGNMENT_APPROVED → REASSIGNED    | Replacement tạo thành công         | Old assignment liên kết replacement mới ASSIGNED.                                     |
| Active → CANCELLED                    | Instructor cancel/reopen có reason | Thu hồi quyền; không xóa history hoặc review đã có.                                   |

COI sau khi review đã submit là exceptional instructor invalidation/correction flow, không cho reviewer tự rút một review đã công bố qua endpoint bình thường. Approval và replacement có thể là hai bước; giữa hai bước slot hiển thị thiếu reviewer, không giả là đã có người thay.

### 6.2 Thuật toán và chứng minh tính khả thi

Input của engine gồm snapshot submissions/version/cycle, review counts, reviewer eligibility, active assignments, membership history cần kiểm, approved COI pairs và workload hiện có. Engine là pure domain service; apply side effects nằm ở application service.

Hard constraints:

- reviewer group khác author group, không có shared student membership làm assignment không hợp lệ;
- đúng offering/role/active eligibility; không duplicate target, không dùng assignment đã approved COI trong vòng đó;
- không sửa assignments đã submit; rerun mặc định chỉ lấp slot thiếu;
- không hạ requested review count hoặc nới COI để tạo một kết quả trông có vẻ đủ.

Thứ tự quyết định tự động được chốt như sau để không làm yếu yêu cầu tránh reciprocal khi có phương án khác:

1. Tìm nghiệm đáp ứng đủ requested counts và hard constraints.
2. Trong các nghiệm đủ, thử ràng buộc **không có reciprocal pair**. Nếu tồn tại, chọn trong tập này.
3. Chỉ khi đã chứng minh tập không reciprocal bất khả thi mới cho reciprocal; trước hết tối thiểu hóa số reciprocal pairs.
4. Cân bằng tổng workload giữa những reviewer đủ điều kiện trong tập nghiệm còn lại, ví dụ tối thiểu hóa chênh lệch rồi tổng bình phương tải; metric được ADR ghi rõ.
5. Tie-break canonical theo ordered IDs để cùng snapshot và policy cho cùng output.

Mô hình đề xuất cho spike A07 là constrained binary assignment: biến chọn reviewer→submission; quota constraints; fixed existing assignments; biến reciprocal cho hai chiều giữa cùng hai nhóm. Embedded optimization solver hoặc bounded deterministic backtracking là hai implementation candidate. Chọn sau khi kiểm license, packaging, deterministic behavior và benchmark pilot; không chọn dependency chỉ theo tên nổi tiếng.

Không dùng greedy một lượt hoặc random shuffle rồi kết luận “không có nghiệm không reciprocal”. `INFEASIBLE` đòi hỏi bằng chứng từ solver/search đầy đủ. `TIME_LIMIT/UNKNOWN` là kết quả riêng: giữ proposal để staff xem nếu hữu ích nhưng không tự apply hoặc tuyên bố tối ưu. Staff có thể đổi configuration/manual assignment; hard COI constraints vẫn giữ nguyên. Kết quả đủ nhưng optimization chưa chứng minh tối ưu phải được ghi rõ, không gắn nhãn “đã đảm bảo tránh reciprocal khi có thể”.

API auto-assignment gồm preview và apply:

- Preview trả snapshot revision, proposed pairs, workload before/after, excluded pairs/reasons, unmet demand, feasibility/optimality status và objective scores.
- Mặc định chỉ apply plan đủ và đã đạt các bảo đảm được contract cam kết. Không silently apply partial plan. Nếu cần partial workflow, A00 phải chốt command explicit riêng trước khi thêm.
- Apply kiểm lại membership/submission/COI/config revision, dùng lock/transaction và idempotency key; stale preview trả 409, không tự âm thầm tạo plan mới khác preview.
- Test fixtures gồm 1 nhóm; 2 nhóm bắt buộc reciprocal; nhiều nhóm có nghiệm cycle không reciprocal; k quá lớn; graph COI; workload cũ lệch; assignment submitted cố định; shared membership lịch sử; concurrent apply.
- Q00 có exhaustive oracle cho graph nhỏ để so feasibility/reciprocal optimum/workload objective; benchmark cỡ lớp pilot khác nhau. Benchmark không được trở thành lý do bí mật bỏ yêu cầu.

## 7. Review, rebuttal và discussion

- Review save draft yêu cầu assignment active, đúng member/instructor, đúng cycle/version, còn review window. Cùng nhóm dùng optimistic concurrency, không last-write-wins gây mất nội dung.
- Review submit kiểm đủ criteria, score range, required comments/recommendation theo rubric, assignment state và deadline trong một transaction. Các trường computed/status/submitter không tin từ client.
- Submitted reviews chỉ thấy bởi reviewer owner và instructor trước release. Author chỉ thấy submitted reviews đã release trong batch; review draft và COI reason không nằm trong response author.
- Correction được instructor cấp phép với reason/deadline; reviewer tạo bản revision mới, original vẫn truy được bởi actor được phép. Không cho instructor sửa lời review như thể reviewer tự viết.
- Rebuttal chỉ author group, chỉ current released cycle, general + optional per-review response. Review-specific response phải tham chiếu review tác giả được xem.
- Author finalize làm rebuttal immutable; expiry chặn mọi student edit ngay tại endpoint kể cả job chưa đánh dấu expired. Instructor reopen cấp hạn mới có audit.
- Discussion là text/markdown được sanitize; raw HTML không được render. Context review phải thuộc submission. Permission/identity theo audience được áp dụng cả list, create response và notification.
- MVP không cần edit/delete discussion. Nếu bổ sung moderation/correction, phải lưu audit và không làm mất evidence âm thầm.

## 8. Policy và anonymity

### 8.1 Ma trận quyền mặc định

| Resource/action        | Author group                                                  | Assigned peer/instructor reviewer                            | Instructor quản lý offering                        | Admin                                       |
| ---------------------- | ------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------- | ------------------------------------------- |
| Offering/project       | Membership context; project của mình                          | Metadata cần cho assignment                                  | Toàn offering được giao                            | Theo catalog/oversight policy explicit      |
| Upload/submit version  | Đúng group, window/state                                      | Không                                                        | Audited override/reopen riêng                      | Không tự impersonate author                 |
| Private PDF            | Own history trong scope                                       | Exact version của assignment active                          | Toàn evidence của offering                         | Privileged policy + audit                   |
| Review draft           | Không                                                         | Draft của assignment mình                                    | Xem monitor nếu policy cho; không giả làm reviewer | Không mặc nhiên                             |
| Released review        | Own submission                                                | Own review; review khác theo explicit policy, mặc định không | Tất cả                                             | Theo academic oversight permission          |
| Reviewer real identity | NAMED theo release rule; ANONYMOUS thì không                  | Biết identity của chính mình                                 | Luôn thấy thật trong offering quản lý              | Chỉ appropriate permission                  |
| COI reason             | Không                                                         | Declaration của assignment mình                              | Xem/decide                                         | Explicit oversight permission               |
| Rebuttal               | Author edit trong window                                      | Read nếu scope assignment/cycle cho phép                     | Xem/reopen                                         | Explicit permission                         |
| Similarity             | Kết quả author được release theo policy; không staff controls | Không mặc định                                               | Manage                                             | Explicit similarity management permission   |
| Grade draft            | Không                                                         | Không                                                        | View/edit đúng offering                            | Không mặc nhiên grade author                |
| Published grade        | Own group/history                                             | Không                                                        | View/publish                                       | Explicit oversight permission               |
| Reference archive      | Eligible later cohort, approved version                       | Không thêm quyền chỉ vì reviewer                             | Manage course/offering mình được giao              | Explicit archive oversight                  |
| Users/catalog/audit    | Profile của mình                                              | Profile của mình                                             | Catalog read và audit context cho phép             | Account/catalog administration + audit read |

Admin global role phải được ánh xạ thành các permissions được định nghĩa rõ. Không có unconditional “isAdmin return true” trong mọi domain guard. A00/A04 chốt tập quyền mặc định đủ cho admin quản trị và staff similarity, đồng thời test riêng quyền quản lý học thuật nếu được cấp.

Policies tối thiểu: canViewOffering, canManageOffering, canViewProject, canEditSubmission, canSubmitVersion, canViewFile, canReview, canViewReview, canViewReviewerIdentity, canDeclareCOI, canDecideCOI, canSubmitRebuttal, canPostDiscussion, canGrade, canManageSimilarityCheck, canViewArchiveReport, canManageArchivePublication.

### 8.2 Identity protection

- Presenter theo audience tạo DTO riêng; không serialize Prisma rồi xóa một trường tên.
- Alias reviewer ổn định trong một submission/cycle, như “Reviewer 1”; không encode group UUID/student ID trong alias, URL hoặc sort key public.
- Các trường cần kiểm gồm reviewerGroupId, userId, submittedBy, profile/avatar URLs, filenames, nested object, correction metadata, discussion authors, COI content, notification body/target metadata, archive projections và audit endpoints.
- Instructor cùng offering thấy real identity; instructor lớp khác không có quyền chỉ vì global role. Khi user vừa là author vừa có role khác, presenter quyết định theo quyền cao nhất thực sự hợp lệ trong chính context đó.
- Public response/read model cho reference archive chỉ có publication/project/course/stage/version metadata được duyệt và file endpoint. Không kéo toàn bộ review evidence vào archive rồi hy vọng UI không hiển thị.
- Client cache/SSR/RSC không được dùng dữ liệu staff cho author: private cache/no-store, query keys theo user/context, clear cache khi logout/account switch. Frontend adapter không phải security boundary.
- Tests duyệt nested JSON và channel notifications/discussion/archive/file metadata; không chỉ assertion thiếu `reviewerName` ở root.

## 9. Similarity và grading

### 9.1 Manual COOPY state machine

| Transition                                   | Actor/guard                           | Dữ liệu yêu cầu                                                   |
| -------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------- |
| Chưa có → PENDING                            | Submit final hoặc stage yêu cầu check | Exact submittedVersion; idempotent create.                        |
| PENDING → SUBMITTED_EXTERNALLY               | Instructor/admin có quyền             | Staff xác nhận đã thao tác ngoài hệ thống; timestamp.             |
| SUBMITTED_EXTERNALLY → COMPLETED             | Instructor/admin có quyền             | Result date; notes; percentage nếu có; optional result PDF READY. |
| PENDING/SUBMITTED_EXTERNALLY → FAILED        | Instructor/admin có quyền             | Mandatory reason.                                                 |
| PENDING/SUBMITTED_EXTERNALLY/FAILED → WAIVED | Instructor/admin có quyền             | Mandatory waiver reason.                                          |
| FAILED → PENDING                             | Staff retry                           | Retry reason, history attempt/audit.                              |

Completed/waived là evidence terminal thông thường. Sửa kết quả đã ghi cần correction có reason/audit và giữ giá trị cũ trong lịch sử; không dùng arbitrary status PATCH. Upload result PDF chịu storage/authorization checks như report PDF. Kết quả này nói về tương đồng văn bản, không tự kết luận plagiarism hoặc đánh giá giống ý tưởng/sơ đồ/chủ đề.

### 9.2 Grade contract

- Grading read model gom project, version/history, actual reviewer identities, submitted reviews/corrections, rebuttal, discussion, exact-version similarity và rubric. Đây là staff endpoint riêng, không dùng lại response author rồi vô tình expose.
- Draft grade private; assignment reviewer không được thấy điểm chỉ vì có review access.
- Mỗi grade revision pin submissionVersion và rubric revision. Per-criterion score phải đầy đủ theo grading rubric, cùng rubric, trong range.
- Default overall: `10 × sum(weight × (score − scoreMin)/(scoreMax − scoreMin)) / sum(weight)`. Tổng weight dương; scoreMax > scoreMin; dùng Decimal, chốt rounding lúc output/publish. Mặc định đề xuất 2 chữ số thập phân cho display/published total.
- Instructor có thể override overall 0–10 với lý do, audit và giữ calculated total để giải thích. Không dùng peer average làm điểm cuối tự động.
- Publish yêu cầu evidence/version hiện hành đã khóa, grading rubric hợp lệ và permission đúng offering. Với bất kỳ stage nào `requireSimilarityCheck=true`, chỉ COMPLETED hoặc WAIVED **đúng version** mới đủ; FAILED/PENDING/SUBMITTED_EXTERNALLY không đủ.
- Publish lưu immutable revision, actor/time, audit và notification cùng transaction. Retry không phát notification lặp.
- Correction/regrade tạo draft revision mới; published revision cũ vẫn là lịch sử. Full submission reopen đánh dấu cũ superseded; không trình bày nó như grade của PDF mới.

## 10. Archive và file authorization

Own archive và reference archive là hai policy khác nhau:

1. **Own archive:** liệt kê project người dùng từng là group member theo lịch sử, kể cả offering membership hiện tại đã kết thúc. Quyền đọc từng version/evidence xét khoảng tham gia hoặc snapshot authorship: việc từng ở nhóm không tự cấp quyền tới mọi phiên bản được tạo sau khi rời nhóm. Profile vẫn hiển thị project đã từng tham gia; A00 phải ghi rõ policy cho former members trước implementation.
2. **Reference archive:** publication chưa revoke, version được duyệt thuộc finalized submission của project hoàn tất, source offering CLOSED/ARCHIVED, viewer là student ở offering sau của cùng Course theo termStartAt. Grade/review/COI không tự đi kèm quyền reference.
3. Instructor/admin theo scope có thể search student và quản lý approval. Students không có endpoint search tùy ý toàn bộ student.

Mặc định publication chỉ một approved report version cho project/reference context; instructor thay version phải có approve action mới và giữ history approval cũ. Revoke phải có hiệu lực ở cả list/detail/PDF/range/download requests, không chỉ ẩn card.

- API file kiểm quyền tại thời điểm request; không lấy storage key từ client làm nguồn quyền.
- Private object không public bucket. Local development phục vụ qua backend; S3/MinIO cũng cùng policy interface.
- Inline PDF là mặc định reference; download endpoint chỉ khi publication allowDownload. Không hứa inline là DRM.
- Nếu dùng signed URL, TTL ngắn và nêu rõ revoke có cửa sổ token còn hiệu lực; mặc định backend proxy phù hợp requirement revoke tức thời hơn. Không cache private PDF công khai.
- Range requests phải kiểm quyền như full file; result PDF của similarity và old versions có policy riêng.
- Không endpoint bulk-export tất cả reference reports. Pagination và rate limits phù hợp, audit privileged downloads/access.

## 11. Auth, API families và DTO

### 11.1 Auth contract

- Local username/email + Argon2/bcrypt hash; access token ngắn hạn giữ memory client; rotating refresh token trong HttpOnly cookie.
- Same-origin `/api/v1` qua reverse proxy để giảm CORS complexity; cookie Secure trong production, SameSite phù hợp, refresh/logout kiểm Origin/CSRF theo cookie model. Không đặt access/refresh token trong localStorage hoặc URL.
- Refresh rotation dùng atomic transaction: token cũ không được reuse; reuse revoke family theo strategy đã ADR chốt. Logout revoke session; password reset/deactivate revoke sessions.
- Mỗi request kiểm user active/revocation strategy, không chờ access token hết hạn mới áp dụng deactivation nếu contract hứa chặn ngay.
- Login/refresh/password reset rate limiting; lỗi sanitized, không log password/token/cookie. Admin reset không gửi password qua CSV hoặc giả impersonation.

### 11.2 Stable resource families

Các route sau là đề xuất contract để A00/A03/A04 chốt, không phải endpoint đã tồn tại. Dùng `/api/v1`, UUID, JSON DTO, OpenAPI generated client. Các command POST chốt dữ liệu cần idempotency key.

| Family              | Endpoint/command đại diện                                                                                                               | Task    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Auth/profile        | `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/sessions`, `/me`, `/me/password`                                                 | A04/A14 |
| Users/admin         | `/users`, `/users/:id/activation`, `/users/:id/role`, `/users/:id/password-reset`                                                       | A14     |
| Catalog             | `/courses`, `/courses/:id`                                                                                                              | A05/A14 |
| Offerings           | `/offerings`, `/offerings/:id`, `/offerings/:id/copy`, `/offerings/:id/activate`, `/close`, `/reopen`, `/archive`                       | A05     |
| Roster              | `/offerings/:id/memberships`, `/roster-imports/preview`, `/roster-imports/:previewId/commit`                                            | A05     |
| Groups/projects     | `/offerings/:id/groups`, `/groups/:id/members`, `/projects/:id`                                                                         | A05     |
| Stages/rubrics      | `/offerings/:id/stages`, `/stages/:id`, `/rubrics`, `/rubrics/:id/revisions`                                                            | A05     |
| Submissions         | `/projects/:id/submissions`, `/submissions/:id`, `/submissions/:id/versions`, `/submit`, `/reopen`, `/finalize`                         | A06     |
| Files               | `/submission-versions/:id/file`; explicit authorized download variant khi được phép                                                     | A06     |
| Assignments         | `/offerings/:id/assignment-plans`, `/assignment-plans/:id/apply`, `/reviewer-assignments`, `/reviewer-assignments/:id/cancel`           | A07     |
| COI                 | `/reviewer-assignments/:id/conflicts`, `/conflicts/:id/decision`, `/reviewer-assignments/:id/replacement`                               | A07     |
| Reviews             | `/reviewer-assignments/:id/review`, `/reviews/:id/submit`, `/reviews/:id/correction-authorizations`, `/submissions/:id/reviews/release` | A08     |
| Rebuttal/discussion | `/submissions/:id/rebuttal`, `/rebuttals/:id/finalize`, `/rebuttals/:id/reopen`, `/submissions/:id/discussions`                         | A09     |
| Similarity          | `/similarity-checks`, `/:id/mark-external`, `/:id/complete`, `/:id/fail`, `/:id/waive`, `/:id/retry`, `/:id/result-file`                | A10     |
| Grading             | `/submissions/:id/grading-context`, `/submissions/:id/grade`, `/grades/:id/publish`, `/grades/:id/revisions`                            | A11     |
| Archive             | `/archive/own`, `/archive/references`, `/archive/publications`, `/archive/publications/:id/revoke`, `/:id/file`                         | A12     |
| Notifications/audit | `/notifications`, `/notifications/:id/read`, `/notifications/read-all`, `/audit-logs`                                                   | A13     |
| Dashboards          | Role-aware `/dashboard` hoặc `/offerings/:id/progress`; chỉ read-model từ domain thật                                                   | A05–A14 |

Các suffix viết tắt trong bảng thuộc resource cùng ô; contract OpenAPI cuối phải ghi URL đầy đủ, không để frontend tự đoán. Dashboard counts chỉ tính dữ liệu user có quyền xem; không làm side channel lộ số lượng/private work của lớp khác.

### 11.3 DTO/error conventions

- Không raw Prisma objects; request DTO allowlist writable fields. Client không được set uploadedBy/submittedBy/approvedBy/status tùy ý.
- Date ISO-8601 UTC; Decimal serialize thống nhất; pagination `{items, pageInfo}` hoặc convention duy nhất được A00 chốt, bounded limits, sorting/filter allowlist.
- Error `{code, message, fieldErrors?, requestId}`; 401 auth thiếu/hỏng, 403 denied khi existence public/context known, 404 cho private resource cần che tồn tại, 409 stale state/revision, 422 domain input theo convention thống nhất.
- Policy cho hidden resource phải nhất quán list/detail/file; không dùng khác biệt error để lộ private existence.
- Public response types tách author/reviewer/staff/archive views. `allowedActions` là UX hint và không thay backend authorization.
- API layer frontend consume DTO, adapter thành view model. Không dùng reviewer identity bị ẩn trong `data-*`, hidden input, URL query hoặc client analytics.

## 12. Concurrency, transaction và side effects

| Race/failure                       | Biện pháp đề xuất                                                     | Acceptance                                                       |
| ---------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Hai upload cùng submission         | Lock/counter trong transaction + unique version number; retry bounded | Không mất file/version hoặc trùng số.                            |
| Storage upload thành công, DB fail | Temp object/READY lifecycle, compensation cleanup có job retry        | Không reference file chưa tồn tại; orphan được dọn có kiểm soát. |
| DB intent có nhưng storage fail    | Không submit file non-READY; retries và failure state rõ              | Không ghi SUBMITTED cho PDF chưa bền vững.                       |
| Hai thành viên sửa draft           | `revision`/If-Match; update compare-and-swap                          | Writer stale nhận 409, UI có recover path.                       |
| Submit vs reviewer save/reopen     | Lock current submission/assignment cycle; guards trong transaction    | Không lưu draft vào cycle đã superseded.                         |
| Double review submit/grade publish | Idempotency scoped actor/action/resource + request hash               | Một event/audit logical; payload khác cùng key bị reject.        |
| COI approve/reject cùng lúc        | Pending-state CAS + transaction                                       | Chỉ một decision, quyền cũ thu hồi ngay khi approved.            |
| Auto-assignment apply trùng        | Snapshot revision + offering/stage lock + unique constraint           | Không duplicate, stale plan 409.                                 |
| CSV preview rồi roster thay đổi    | Preview hash/revision, revalidate khi commit; atomic insert           | Không partial roster hoặc “success” khi một row đã invalid.      |
| Deadline job chạy trễ              | Mutation luôn dùng server clock                                       | Bằng/sau hạn vẫn bị chặn.                                        |
| Outbox job retry/crash             | Event unique key; processing lease; recipient/type/entity dedup       | Notification không mất/lặp khi crash quanh commit.               |
| Archive revoke lúc PDF access      | Authorization tại request; private no-store; policy ký URL như mục 10 | Request mới bị chặn sau revoke.                                  |
| Password reset/deactivate          | Transaction user/session revocation + active checks                   | Session cũ không tiếp tục dùng private APIs.                     |

Business mutation + audit + outbox intent cùng DB transaction. Worker tạo notification theo audience tại thời điểm delivery; payload chỉ chứa dữ liệu cần thiết, không ghi raw review entity rồi gửi lại. Scheduler là bộ hỗ trợ nhắc hạn/reconcile state; GET request không âm thầm mutate domain.

Audit actor SYSTEM dùng cho scheduler; actor user thật dùng cho lệnh thủ công. Audit append-only ở API/service; A03/A13 xem xét DB grants/trigger để bảo vệ nhưng không trì hoãn core workflow vì dựng hệ event sourcing. Không dùng audit log làm database nghiệp vụ thay cho các entity đã thiết kế.

## 13. CSV và seed acceptance

CSV MVP: validate/preview rồi commit atomic; chỉ thêm user đã tồn tại. Unknown email là lỗi có dòng/cột và hướng dẫn Admin tạo account, không âm thầm tạo password. Duplicate input, invalid email, non-student membership và user đã có trong offering phải có outcome thống nhất. Đề xuất existing same-role membership là no-op trong summary; incompatible role là error. Commit revalidate toàn bộ và không thay đổi gì nếu còn error.

Seed tối thiểu cho A03/Q00:

- Admin, instructor, 8–12 student accounts; development-only password có tài liệu. Demo seed explicit opt-in chỉ trong `APP_ENV=local/test`; có thể kiểm bằng production build `NODE_ENV=production`, nhưng không seed demo vào môi trường triển khai thật `APP_ENV=production`.
- Systems Analysis and Design Course; một offering active, một offering closed/archived có project cũ, một offering sau để chứng minh eligibility reference.
- Nhiều nhóm, Proposal/Final Report, rubric revision, PDF mẫu hợp lệ, v1/v2, assignments, review drafts/submitted/released, rebuttal.
- Pending và completed similarity trên exact versions; published grade; approved và non-approved/revoked reference cases.
- Membership history đủ kiểm own past project. Không seed bằng cách vô hiệu hóa constraint.
- Dev demo dùng mốc ngày có hướng dẫn; automated tests dùng fixed clock để không hỏng theo thời gian thực.

## 14. Gate và bằng chứng cần có trước DONE

Đây là checklist dành cho implementation, hiện chưa có mục nào được coi là PASS:

1. A00/A03 chốt ERD, DB/service invariant map, state/permission/API DTO contracts và ADR cho reopen, membership, release, archive, assignment objectives.
2. A04/Q00 chứng minh cross-offering denial, inactive/session revocation, hidden draft grades, real identity chỉ đúng audience.
3. A05/A06 chứng minh copy-config-only, atomic CSV, active-group uniqueness, membership freeze, v1/v2 immutable và authorized file access.
4. A07/Q00 chứng minh deterministic engine, no self/duplicate, reciprocal feasibility, timeout khác infeasible, workload objective và atomic reassign.
5. A08/A09 chứng minh batch release, exact-version review, correction history, optimistic draft conflict, deadline/reopen và anonymous discussion.
6. A10/A11 chứng minh manual COOPY states, mandatory reasons, similarity-v1 không satisfy grade-v2, formula boundaries, draft privacy và idempotent publish.
7. A12 chứng minh own history, same-course later-cohort reference, explicit version approval/revoke, không leak review/grade từ archive và kiểm quyền PDF/range.
8. A13 chứng minh audit/outbox transactional, reminder deduplication, retry/restart và identity-safe notifications.
9. Q01 chạy end-to-end trên PostgreSQL + private storage + production local build thật. Chỉ ghi kết quả thực tế vào evidence; không suy đoán hệ thống hoạt động từ tài liệu thiết kế.
