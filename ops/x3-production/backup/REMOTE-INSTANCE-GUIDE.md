# Hướng dẫn Backup & Restore cho Môi trường Domain `taman-dev.shiroisdumb.com`

Tài liệu cấu hình và thực thi quy trình Sao lưu & Phục hồi dữ liệu cho máy chủ triển khai tại domain **`taman-dev.shiroisdumb.com`**.

---

## 1. Cấu hình Môi trường Server

Cấp phát secret files bên ngoài repository và web roots. Đưa các đường dẫn tuyệt đối (không phải giá trị secret) vào một file operator-only, ví dụ `/etc/tamancare/production-secret-paths.env`, rồi dùng `docker compose --env-file /etc/tamancare/production-secret-paths.env`. Không lưu file này trong checkout.

```env
TAMANCARE_POSTGRES_PASSWORD_FILE=/secure/path/postgres-password
TAMANCARE_DATABASE_URL_FILE=/secure/path/database-url
TAMANCARE_JWT_SECRET_FILE=/secure/path/jwt-secret
```

Set the non-secret service configuration through the approved operator environment. Secret files should be regular, non-symlink files with mode `0400` or `0600`; keep parent directories restricted as well.

---

## 2. Thực thi Sao lưu (Backup) từ xa hoặc trên Server Host

### Cách 1: Chạy trực tiếp qua Docker Container trên Server `taman-dev`

```bash
# Truy cập vào máy chủ VPS/Server của taman-dev.shiroisdumb.com
docker compose --env-file /etc/tamancare/production-secret-paths.env -f deploy/production/docker-compose.production.yml exec db-backup sh /scripts/backup.sh
```

Tệp sao lưu `.dump` và tệp đối soát `.manifest` sẽ tự động tạo tại thư mục `/backups` (gắn volume `tamancare_backups`).

### Cách 2: Chạy từ xa bằng secret file được bảo vệ

Nếu bạn kết nối trực tiếp đến PostgreSQL của `taman-dev.shiroisdumb.com`:

```bash
export DATABASE_URL_FILE="/secure/path/database_url"
export BACKUP_DIR="./backups-taman-dev"

sh ops/x3-production/backup/backup.sh
```

---

## 3. Thực thi Phục hồi & Diễn tập (Restore & Verification)

### Bước 1: Khôi phục bản sao lưu vào Cơ sở dữ liệu Khôi phục Cách ly

> ⚠️ **Lưu ý an toàn**: Không phục hồi trực tiếp lên database đang phục vụ người dùng thực tế tại `taman-dev.shiroisdumb.com`.

```bash
# Thiết lập kết nối tới DB thử nghiệm/DR Instance
export DATABASE_URL_FILE="/secure/path/database_url"

# Thực hiện phục hồi từ file dump đã xác minh SHA-256
sh ops/x3-production/backup/restore.sh ./backups-taman-dev/tamancare-20260915T103000Z.dump
```

### Bước 2: Chạy kiểm định tính toàn vẹn dữ liệu

```bash
export DATABASE_URL_FILE="/secure/path/database_url"

sh ops/x3-production/dr/verify-restore.sh
```

---

## 4. Tự động hóa Lập lịch trên `taman-dev.shiroisdumb.com`

Khi khởi chạy hệ thống bằng Docker Compose trên server:

```bash
docker compose --env-file /etc/tamancare/production-secret-paths.env -f deploy/production/docker-compose.production.yml up -d
```

Container `db-backup` sẽ tự động khởi động và chạy sao lưu mỗi ngày vào lúc 02:00 AM UTC, duy trì lịch sử bản sao lưu trong 14 ngày.
