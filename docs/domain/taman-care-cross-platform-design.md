---
type: domain-concept
created: 2026-09-01
updated: 2026-09-01
---

# Chuẩn Thiết Kế Giao Diện Đa Nền Tảng (Cross-Platform UI/UX) — Tâm An Care

## 1. Cấu Trúc Menu Điều Hướng Chuẩn (10 Phân Hệ)
Thứ tự menu điều hướng sidebar thống nhất:
1. **Tổng quan** (`/dashboard`)
2. **Tiếp nhận & Đánh giá** (`/admissions`)
3. **Sơ đồ Phòng & Giường** (`/accommodation`)
4. **Người cao tuổi** (`/residents`)
5. **Vận hành chăm sóc** (`/operations`)
6. **Nhân sự & Phân quyền** (`/staff-access`)
7. **Nghỉ phép & Tạm vắng** (`/resident-leave`)
8. **Báo cáo sức khoẻ** (`/health-reports`)
9. **Lịch trực & Ca kíp** (`/workforce`)
10. **Trạng thái hệ thống** (`/system-status`)

## 2. Nền Tảng Hỗ Trợ Đồng Bộ
Hệ thống giao diện được thiết kế tương thích hoàn toàn trên tất cả các nền tảng:
- **Web Browser** (Chrome, Safari, Edge, Firefox)
- **Desktop App** (macOS, Windows)
- **Mobile & Tablet** (iOS, iPadOS, Android)

## 3. Các Quy Tắc Layout Chuẩn Hóa
1. **Lưới thẻ KPI đồng bộ (`.kpi-grid` & `.kpi-box`):**
   - Tự động co giãn: 6 cột trên Desktop, 3 cột trên Tablet, 2 cột trên Mobile.
   - Chiều cao đồng nhất, tiêu đề in hoa nhẹ nhàng, số liệu to rõ ràng kèm màu sắc ngữ cảnh.
2. **Thanh điều phối & lọc (`.filter-toolbar` & `.filter-toolbar-grid`):**
   - Bố cục responsive dạng grid, nhãn form rõ ràng, chiều cao input chuẩn 40px - 44px tối ưu cho cả chuột và cảm ứng ngón tay.
3. **Lưới thẻ danh sách thực thể (`.entity-grid-cards` & `.entity-card-uniform`):**
   - Đảm bảo các ô trong cùng danh sách có kích thước đồng đều, card flexbox tự động đẩy nút thao tác xuống chân thẻ.
4. **Touch Targets & Typography:**
   - Nút bấm tối thiểu 36px - 44px trên thiết bị cảm ứng, không để chữ tràn khung.
