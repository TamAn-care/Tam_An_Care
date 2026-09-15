# TamAnCare Database Restore & Disaster Recovery Runbook

Tài liệu hướng dẫn thao tác chuẩn (Standard Operating Procedure - SOP) cho việc Sao lưu, Phục hồi Dữ liệu và Diễn tập Phục hồi Thảm họa tại Viện dưỡng lão Tâm An Care.

---

## 1. Mục tiêu Khôi phục (Recovery Objectives)

- **RPO (Recovery Point Objective)**: $\le$ 24 giờ đối với bản sao lưu logic định kỳ (`pg_dump` custom format).
- **RTO (Recovery Time Objective)**: $\le$ 60 phút cho toàn bộ quy trình khôi phục cơ sở dữ liệu.
- **Tiêu chuẩn An toàn**: Tuyệt đối không phục hồi đè trực tiếp lên cơ sở dữ liệu Production đang chạy mà chưa qua kiểm tra cách ly.

---

## 2. Quy trình Phục hồi Dữ liệu Tự động (Automated Restore Process)

### Bước 1: Chuẩn bị Môi trường Phục hồi Cách ly

Tạo hoặc chuẩn bị cơ sở dữ liệu thử nghiệm cách ly (ví dụ: `tamancare_dr_test`):

```bash
export DATABASE_URL="postgresql://postgres:secret@localhost:5432/tamancare_dr_test?sslmode=disable"
export BACKUP_DIR="/path/to/tamancare/backups"
```

### Bước 2: Chạy Script Phục hồi `restore.sh`

1. **Phục hồi bản sao lưu mới nhất trong `BACKUP_DIR`**:
   ```bash
   sh ops/x3-production/backup/restore.sh
   ```

2. **Phục hồi từ một file `.dump` cụ thể**:
   ```bash
   sh ops/x3-production/backup/restore.sh /path/to/tamancare-20260915T000000Z.dump
   ```

Script `restore.sh` sẽ tự động:
- Đọc file `.manifest` tương ứng (nếu có) và đối soát mã băm SHA-256 (`sha256sum`).
- Kiểm tra cấu trúc tệp dump bằng `pg_restore --list`.
- Khôi phục schema và dữ liệu vào database chỉ định qua `DATABASE_URL`.

---

## 3. Diễn tập & Xác minh Tính toàn vẹn (Verification Drill)

Sau khi chạy `restore.sh` thành công, thực hiện chạy script kiểm định:

```bash
sh ops/x3-production/dr/verify-restore.sh
```

Script sẽ thu thập và đối soát các chỉ số theo quy định tại `DR-POLICY.md`:
- Số lượng bảng base tables (Public Table Count)
- Số lượng bảng audit log (Audit Table Count)
- Số lượng hồ sơ Người cao tuổi (`residents`)
- Số lượng công việc chăm sóc (`care_actions`)
- Số lượng đơn thuốc (`medication_orders`)

Kết quả diễn tập khôi phục phải được ghi nhận vào nhật ký diễn tập sự cố (DR Log).

---

## 4. Chuyển đổi Thảm họa (Production Disaster Cutover)

Trong trường hợp xảy ra sự cố thảm họa vật lý hoặc hỏng hóc dữ liệu nghiêm trọng trên Production:

1. **Khóa truy cập Production Edge (Nginx)** để tránh ghi dữ liệu sai lệch mới.
2. Khôi phục cơ sở dữ liệu vào Instance PostgreSQL mới theo **Bước 2** & **Bước 3**.
3. Sau khi `verify-restore.sh` báo `SUCCESS`, thực hiện cập nhật chuỗi kết nối `DATABASE_URL` trong file secret `/run/secrets/database_url`.
4. Khởi động lại API Service:
   ```bash
   docker compose -f deploy/production/docker-compose.production.yml restart api
   ```
5. Mở lại Nginx Edge và kiểm tra health check tại `/api/health/ready`.
