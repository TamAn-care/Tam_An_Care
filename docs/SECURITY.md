# Chính Sách Bảo Mật & Quy Trình Ngăn Ngừa Rò Rỉ Thông Tin (SECURITY.md)
**Hệ Thống Dịch Vụ Chăm Sóc Lão Khoa & Y Tế Tâm An Care**

---

## 1. Tuyên Bố Sứ Mệnh Bảo Mật (Core Philosophy)

> **"Assume Breach - Trust Nothing - Verify Everything - Defense in Depth"**

Tâm An Care quản lý dữ liệu lâm sàng y tế, thông tin cá nhân của người cao tuổi (PHI/PII), tài chính viện phí và lịch trình chăm sóc. Mọi hành vi rò rỉ mật khẩu, mã khóa API (API Key), mã Token xác thực (JWT Secret) hoặc thông tin sức khỏe đều phải được ngăn chặn triệt để ngay từ khâu thiết kế, lập trình và vận hành.

---

## 2. Mô Hình 5 Lớp Bảo Mật Chi Tiết (5-Layer Defense-in-Depth)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Environment & Secrets Management (Zero Hardcoding)       │
├─────────────────────────────────────────────────────────────┤
│ 2. Authentication & Credential Security (PBKDF2 + JWT)       │
├─────────────────────────────────────────────────────────────┤
│ 3. Data Privacy & PHI/PII Redaction (Logging & Response)    │
├─────────────────────────────────────────────────────────────┤
│ 4. Access Control (RBAC 12 Roles) & API Hardening           │
├─────────────────────────────────────────────────────────────┤
│ 5. Automated Scanning & Incident Response                   │
└─────────────────────────────────────────────────────────────┘
```

### Lớp 1: Quản Lý Bí Mật & Môi Trường (Zero Hardcoding Policy)
- **Cấm Hardcode Bí Mật**: Tuyệt đối không lưu mật khẩu Database, JWT Secret, API Key (Payment, SMS, AI Gateway, Cloud Storage) trực tiếp trong mã nguồn, file script, Dockerfile hay documentation.
- **Biến Môi Trường (`.env`)**:
  - Mọi bí mật được đọc qua `process.env`.
  - Không bao giờ commit file `.env`, `.env.production` hay bất kỳ `.env.*.local` nào vào mã nguồn.
  - Sử dụng file `.env.example` chứa biến mẫu để hướng dẫn lập trình viên.
- **Quản lý Secrets trên Production**:
  - Sử dụng Docker Secrets (`/run/secrets/`) hoặc dịch vụ Secrets Vault (HashiCorp Vault, AWS Secrets Manager, GCP Secret Manager).
  - Phân tách môi trường rõ ràng giữa DEV, STAGING và PRODUCTION với các khóa bí mật độc lập.

---

### Lớp 2: Bảo Mật Tài Khoản & Mật Khẩu (Auth & Passwords)
- **Mã Hóa Mật Khẩu**:
  - Mã hóa chuẩn PBKDF2 (Password-Based Key Derivation Function 2) kết hợp với ngẫu nhiên Salt cho từng tài khoản.
  - Độ dài Salt tối thiểu 16-32 bytes.
  - Số vòng lặp iterations phù hợp (tối thiểu 10,000-100,000 vòng).
  - Sử dụng so sánh hằng số thời gian `crypto.timingSafeEqual` để chống tấn công Timing Attack.
- **Chống Đăng Nhập Brute-Force**:
  - Giới hạn thử sai mật khẩu: Tối đa **5 lần**. Quá 5 lần sai sẽ tạm khóa tài khoản (`locked_until`) trong **15 phút**.
- **Quản Lý Token JWT (JSON Web Tokens)**:
  - `JWT_SECRET` bắt buộc phải có độ dài **tối thiểu 32 ký tự** có độ ngẫu nhiên cao. Hệ thống tự động abort startup nếu secret không đủ độ dài.
  - Thời gian hết hạn JWT Token: Tối đa **1 giờ (3600 giây)** cho phiên làm việc thông thường.
  - Hỗ trợ hủy phiên làm việc (`revokeSession` / Session Invalidation) khi nhân viên logout hoặc khi phát hiện có bất thường.

---

### Lớp 3: Bảo Vệ Dữ Liệu Lâm Sàng & Cá Nhân (PHI/PII & Logging)
- **Phân Loại Dữ Liệu Nhạy Cảm**:
  - Dữ liệu PII (Personally Identifiable Information): Họ tên, CCCD, Số điện thoại thân nhân, Địa chỉ nhà.
  - Dữ liệu PHI (Protected Health Information): Tiền sử bệnh, chẩn đoán y khoa, đơn thuốc eMAR, chỉ số sinh hiệu (Vital Signs), báo cáo tâm thần/hành vi.
- **Quy Chuẩn Ghi Log An Toàn (Logging Redaction)**:
  - Bộ ghi log (`enterpriseOperationsMiddleware`) chỉ lưu vết metadata: `requestId`, `timestamp`, `method`, `path`, `statusCode`, `durationMs`, `actorId`.
  - **CẤM GIỮ LẠI**: Nội dung `body`, `headers.authorization`, `password`, `token`, `credit_card` hay dữ liệu lâm sàng chi tiết trong stdout/file log.
  - Log level trên Production mặc định là `WARN` hoặc `ERROR` để tránh phơi bày chi tiết không cần thiết.

---

### Lớp 4: Phân Quyền RBAC & Bảo An Mạng (Access Control & Network)
- **Ma Trận Phân Quyền RBAC (12 Vị Trí Việc Làm)**:
  - Phân định ranh giới nghiêm ngặt giữa các vai trò: `SUPERVISOR`, `CARE_MANAGER`, `NURSE`, `CAREGIVER`, `PHARMACIST`, `ACCOUNTANT`,...
  - Mỗi API Endpoint phải được bảo vệ bởi Guard/Middleware kiểm tra `actorRole` và trạng thái `ACTIVE` của nhân sự.
- **Cấu Hình Mạng & API Security**:
  - **Rate Limiting**: Giới hạn tối đa 600 request/phút trên mỗi IP để ngăn chặn DoS/DDoS.
  - **CORS Allowed Origins**: Định nghĩa chính xác danh sách domain được phép gọi API (ví dụ: `https://app.tamancare.vn`). Không dùng `origin: '*'` trên Production.
  - **Security HTTP Headers**: Bắt buộc có các header an toàn:
    - `X-Content-Type-Options: nosniff`
    - `X-Frame-Options: DENY`
    - `Referrer-Policy: no-referrer`
    - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
    - `Strict-Transport-Security: max-age=31536000; includeSubDomains` (HSTS)

---

### Lớp 5: Quét Bí Mật Tự Động & Quy Trình Ứng Phó Sự Cố (Audit & Response)

#### Quét Bảo Mật Định Kỳ (Automated Security Audit)
Lập trình viên và DevOps thực hiện quét mã nguồn trước mỗi lượt commit/deploy bằng công cụ:
```bash
python3 scripts/security_check.py /path/to/tam-an-care
```

#### Quy Trình Xử Lý Khi Phát Hiện Lộ Secret/Password (Incident Response Plan)
1. **Cô Lập & Revoke (Ngay lập tức)**:
   - Thu hồi/đổi khóa API Key hoặc JWT Secret bị rò rỉ trên hệ thống bên thứ ba (AWS, OpenAI, VNPay, Zalo Cloud,...).
   - Đổi mật khẩu toàn bộ tài khoản bị nghi vấn.
2. **Xóa Vết Trên Git History**:
   - Sử dụng `git filter-repo` hoặc BFG Repo-Cleaner để xóa hoàn toàn commit chứa secret rò rỉ khỏi lịch sử Git.
   - Force push lại các branch liên quan sau khi đã làm sạch.
3. **Đánh Giá Tác Động & Nhật Ký (Audit Log Analysis)**:
   - Tra cứu nhật ký truy cập (`auth_sessions`, `http_request` logs) trong khoảng thời gian lộ khóa để kiểm tra xem có truy cập bất thường hay không.
4. **Báo Cáo & Khắc Phục Lỗ Hổng**:
   - Cập nhật quy tắc `.gitignore` hoặc pre-commit hook để đảm bảo sự cố tương tự không tái diễn.

---

## 3. Checklist An Toàn Cho Lập Trình Viên (Developer Security Checklist)

- [ ] KHÔNG commit bất kỳ file `.env` nào lên Git.
- [ ] KHÔNG hardcode mật khẩu, kết nối chuỗi DB, API key vào mã code.
- [ ] Luôn tạo file `.env.example` khi bổ sung biến môi trường mới.
- [ ] Đảm bảo các thuộc tính nhạy cảm (như `password_hash`, `password_salt`) không bị trả về cho phía Frontend.
- [ ] Luôn validate dữ liệu đầu vào (Input Validation) bằng DTO & `class-validator`.
- [ ] Chạy `python3 scripts/security_check.py .` trước khi tạo Pull Request.
