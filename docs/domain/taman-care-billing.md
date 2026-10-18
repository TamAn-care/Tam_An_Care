---
type: domain-concept
created: 2026-09-02
updated: 2026-09-02
---

# Quy Chuẩn Quản Lý Viện Phí & Kế Toán Tài Chính (Series AC — Billing & Invoicing)

## 1. Công Thức Tính Viện Phí Hàng Tháng
$$\text{Tổng Viện Phí} = \text{Gói Chăm Sóc (Cấp 1-3)} + \text{Tiền Phòng} + (\text{Tiền Ăn Chuẩn} - \text{Giảm Trừ RLA-BR-01}) + \text{Suất Ăn Phát Sinh} + \text{Vật Tư/Thuốc Phát Sinh}$$

1. **Gói Chăm Sóc (Theo Phân Cấp):**
   - Cấp độ 1 (Tự chủ 1 phần): 8.000.000 đ/tháng
   - Cấp độ 2 (Phụ thuộc trung bình): 12.000.000 đ/tháng
   - Cấp độ 3 (Chăm sóc đặc biệt): 16.500.000 đ/tháng
2. **Tiền Phòng Ở (Theo Hạng Phòng `Series AA`):**
   - Phòng Đơn VIP (1 giường): 9.000.000 đ/tháng
   - Phòng Đôi Tiêu chuẩn (2 giường): 6.000.000 đ/tháng
   - Phòng 4 Giường Tiết kiệm (4 giường): 4.000.000 đ/tháng
3. **Tiền Ăn Định Mức & Giảm Trừ Tạm Vắng (RLA-BR-01):**
   - Định mức chuẩn: 120.000 đ/ngày (3.600.000 đ/tháng gồm 4 bữa).
   - **Tự động áp dụng Giảm trừ:** Nếu nộp đơn tạm vắng hợp lệ báo trước $\ge 48h$, ngày đầu tính phí, từ ngày thứ 2 trở đi giảm trừ 120.000 đ/ngày vắng mặt.
4. **Vật Tư Tiêu Hao & Thuốc Men Phát Sinh (`Series AD`):**
   - Tự động kết chuyển chi phí từ các giao dịch `EXPORT_RESIDENT` trong tháng (tã bỉm, que thử đường huyết, gạc vô trùng, ống sonde...).

## 2. Quản Lý Hóa Đơn & Trạng Thái Thu Phí
- `PENDING` (Chờ thanh toán) &rarr; `PARTIAL` (Thanh toán 1 phần) &rarr; `PAID` (Đã thu đủ) &rarr; `SETTLED` (Đã khóa sổ quyết toán).
- Phương thức thanh toán: `BANK_TRANSFER` (Chuyển khoản), `CASH` (Tiền mặt), `DEPOSIT_DEDUCTION` (Trừ vào quỹ tiền cọc).

## 3. Phân Quyền & Bảo Mật Dữ Liệu Tài Chính (RBAC)
- **`ACCOUNTANT` (Kế toán):** Toàn quyền lập bảng kê, ghi nhận thanh toán, xuất hóa đơn, điều chỉnh biểu phí.
- **`SUPERVISOR` (Ban Giám đốc):** Toàn quyền xem và phê duyệt quyết toán tài chính.
- **`CARE_MANAGER` (Quản lý):** Xem đối soát chi phí cư dân.
- **Ẩn hoàn toàn với toàn bộ các vị trí lâm sàng và phi tài chính khác.**
