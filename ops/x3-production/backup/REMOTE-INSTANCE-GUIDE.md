# Hướng dẫn Backup & Restore cho Môi trường Domain `taman-dev.shiroisdumb.com`

Tài liệu cấu hình và thực thi quy trình Sao lưu & Phục hồi dữ liệu cho máy chủ triển khai tại domain **`taman-dev.shiroisdumb.com`**.

---

## 1. Cấu hình Môi trường Server (`.env`)

Tại máy chủ triển khai domain `taman-dev.shiroisdumb.com`, cập nhật các tham số môi trường trong tệp `deploy/production/.env`:

```env
TAMANCARE_ENV=production
TAMANCARE_SERVER_NAME=taman-dev.shiroisdumb.com
CORS_ORIGIN=https://taman-dev.shiroisdumb.com

POSTGRES_DB=taman_care
POSTGRES_USER=taman
POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password

DATABASE_URL_FILE=/run/secrets/database_url
JWT_SECRET_FILE=/run/secrets/jwt_secret

BACKUP_RETENTION_DAYS=14
```

---

## 2. Thực thi Sao lưu (Backup) từ xa hoặc trên Server Host

### Cách 1: Chạy trực tiếp qua Docker Container trên Server `taman-dev`

```bash
# Truy cập vào máy chủ VPS/Server của taman-dev.shiroisdumb.com
docker compose -f deploy/production/docker-compose.production.yml exec db-backup sh /scripts/backup.sh
```

Tệp sao lưu `.dump` và tệp đối soát `.manifest` sẽ tự động tạo tại thư mục `/backups` (gắn volume `tamancare_backups`).

### Cách 2: Chạy từ xa qua kết nối DATABASE_URL

Nếu bạn kết nối trực tiếp đến PostgreSQL của `taman-dev.shiroisdumb.com`:

```bash
export DATABASE_URL="postgresql://taman:SECRET_PASSWORD@taman-dev.shiroisdumb.com:5432/taman_care"
export BACKUP_DIR="./backups-taman-dev"

sh ops/x3-production/backup/backup.sh
```

---

## 3. Thực thi Phục hồi & Diễn tập (Restore & Verification)

### Bước 1: Khôi phục bản sao lưu vào Cơ sở dữ liệu Khôi phục Cách ly

> ⚠️ **Lưu ý an toàn**: Không phục hồi trực tiếp lên database đang phục vụ người dùng thực tế tại `taman-dev.shiroisdumb.com`.

```bash
# Thiết lập kết nối tới DB thử nghiệm/DR Instance
export DATABASE_URL="postgresql://taman:SECRET_PASSWORD@taman-dev.shiroisdumb.com:5432/taman_care_dr_test"

# Thực hiện phục hồi từ file dump đã xác minh SHA-256
sh ops/x3-production/backup/restore.sh ./backups-taman-dev/tamancare-20260915T103000Z.dump
```

### Bước 2: Chạy kiểm định tính toàn vẹn dữ liệu

```bash
export DATABASE_URL="postgresql://taman:SECRET_PASSWORD@taman-dev.shiroisdumb.com:5432/taman_care_dr_test"

sh ops/x3-production/dr/verify-restore.sh
```

---

## 4. Tự động hóa Lập lịch trên `taman-dev.shiroisdumb.com`

Khi khởi chạy hệ thống bằng Docker Compose trên server:

```bash
docker compose -f deploy/production/docker-compose.production.yml up -d
```

Container `db-backup` sẽ tự động khởi động và chạy sao lưu mỗi ngày vào lúc 02:00 AM UTC, duy trì lịch sử bản sao lưu trong 14 ngày.
