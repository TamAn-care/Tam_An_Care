---
type: domain-concept
created: 2026-09-02
updated: 2026-09-02
---

# Quy Chuẩn Trung Tâm Phân Tích & Quản Trị Thông Minh (Series AE — Executive Analytics & MI)

## 1. Mục Tiêu & Phạm Vi Điều Hành Vĩ Mô
Trung tâm Phân Tích & Quản Trị Thông Minh (`/analytics-intelligence`) đóng vai trò là "Bộ Não Điều Hành" thời gian thực của Ban Giám đốc và Quản lý Tâm An Care, tổng hợp 4 trụ cột quản trị:

1. **Công Suất & Phòng Giường (Occupancy & Infrastructure):**
   - Giám sát lấp đầy 110 giường trên 29 phòng thuộc 4 tầng.
   - Theo dõi công suất theo 3 hạng phòng (Phòng Đơn VIP, Phòng Đôi Tiêu chuẩn, Phòng 4 Giường Tiết kiệm).
   - Chỉ số luân chuyển (Turnover): Tiếp nhận mới, Tạm vắng, Ra viện.
2. **Lâm Sàng & Chất Lượng Chăm Sóc (Clinical Trends & Safety):**
   - Phân bổ theo 3 cấp độ chăm sóc (Cấp 1: 34%, Cấp 2: 46.8%, Cấp 3: 19.2%).
   - Tỷ lệ tuân thủ cấp phát thuốc eMAR (Chuẩn 5 Đúng, tỷ lệ hoãn/từ chối uống thuốc).
   - Giờ tập phục hồi chức năng và tỷ lệ cải thiện chỉ số sinh hoạt ADL.
3. **Tài Chính & Doanh Thu Vận Hành (Financial Intelligence):**
   - Dự phóng doanh thu vs Thực tế thu hồi vs Công nợ quá hạn.
   - Cơ cấu 5 dòng doanh thu (Gói chăm sóc 60%, Tiền phòng 25%, Dinh dưỡng 10%, Vật tư y tế 5%).
   - Đánh giá tác động tài chính chính sách giảm trừ tiền ăn tạm vắng (`RLA-BR-01`).
4. **Hiệu Quả Nhân Sự & Định Mức Chăm Sóc (Workforce & Operations):**
   - Tỷ lệ chăm sóc (Staff-to-Resident Ratio): Ca ngày đạt 1:3.2 (chuẩn $\le$ 1:3.5), Ca đêm đạt 1:5.8 (chuẩn $\le$ 1:6.0).
   - Tỷ lệ chấp hành ca trực 12 vị trí việc làm (96.8% đúng giờ).
   - Năng suất theo 7 nhóm danh mục chăm sóc chuẩn hóa.

## 2. Phân Quyền & Bảo Mật RBAC
- **`SUPERVISOR` (Ban Giám đốc):** Toàn quyền truy cập tất cả dashboard phân tích vĩ mô và xuất báo cáo điều hành.
- **`CARE_MANAGER` (Quản lý):** Quyền truy cập các tab Vận hành, Lâm sàng, Dinh dưỡng và Nhân sự.
- **Ẩn hoàn toàn đối với các vị trí chuyên môn đơn lẻ.**
