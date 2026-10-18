---
type: domain-concept
created: 2026-09-02
updated: 2026-09-02
---

# Quy Chuẩn Quản Lý Dược Phẩm & Tồn Kho Y Tế (Series AD — eMAR & Medical Inventory)

## 1. Mục Tiêu & Nguyên Tắc An Toàn Lâm Sàng
- **eMAR (Electronic Medication Administration Record):** Số hóa 100% quy trình cấp phát thuốc cho người cao tuổi, loại bỏ nhầm lẫn liều lượng và thời điểm uống.
- **Quy tắc 5 Đúng (5 Rights):**
  1. Đúng Người bệnh (Right Resident)
  2. Đúng Thuốc (Right Medication)
  3. Đúng Liều (Right Dose)
  4. Đúng Đường dùng (Right Route: PO, IV/IM, Topical, Drops, Inhale)
  5. Đúng Thời gian (Right Time: Cữ Sáng 07:30, Trưa 11:30, Chiều 16:30, Tối 20:00)
- **Cảnh báo Dị ứng & Chống chỉ định:** Hiển thị nổi bật cảnh báo dị ứng thuốc (ví dụ: dị ứng Penicillin, NSAIDs) ngay trên từng cữ thuốc.

## 2. Quản Lý Tồn Kho Vật Tư Y Tế & Tiêu Hao
- **Quản lý theo Số lô & Hạn sử dụng (Lot & Expiry):**
  - Cảnh báo màu đỏ khi tồn kho $\le$ Ngưỡng tối thiểu (Low Stock).
  - Cảnh báo màu vàng khi hạn sử dụng còn lại $\le 30$ ngày (Cận hạn).
- **Giao dịch Kho:**
  - Nhập kho bổ sung (Import).
  - Xuất kho sử dụng theo từng người cao tuổi (Export to Resident).
  - Xuất sử dụng cho phòng ban/tủ cấp cứu trực (Export to Department).
  - Điều chỉnh kiểm kê định kỳ (Audit adjustment).

## 3. Phân Quyền & Trách Nhiệm Chuyên Môn (RBAC)
- **Nhân viên y tế / Điều dưỡng (`NURSE`):**
  - **Độc quyền phân chia thuốc** theo đơn của Bác sĩ và tạo/sửa y lệnh.
  - Có trách nhiệm cho các cụ uống thuốc đúng cữ, đúng giờ (chuẩn 5 Đúng).
  - **Độc quyền ký xác nhận eMAR** (Đã uống / Tạm hoãn / Từ chối).
  - Có quyền truy xuất kho vật tư y tế, nhập xuất và cấp phát vật tư cho các Cụ.
- **Quản lý (`CARE_MANAGER`):**
  - Có quyền truy xuất quản lý kho vật tư y tế phục vụ mục tiêu quản lý, kiểm soát định mức.
  - Xem giám sát y lệnh và cữ thuốc (không trực tiếp phân chia thuốc thay chuyên môn y tế).
- **Ban Giám đốc (`SUPERVISOR`):**
  - Có đầy đủ quyền xem toàn diện các phân hệ (eMAR, Y lệnh, Kho vật tư, Báo cáo chi phí) phục vụ công tác quản lý, điều hành và giám sát chất lượng.
- **Nhân viên phục hồi chức năng (`REHABILITATION_SPECIALIST`):**
  - Tuyệt đối **KHÔNG** có quyền hỗ trợ các cụ uống thuốc và không có quyền truy cập phân hệ dược phẩm.
- **Kế toán (`ACCOUNTANT`):**
  - Xem báo cáo nhật ký sử dụng thuốc & vật tư để phục vụ kết chuyển viện phí (`Series AC`).

