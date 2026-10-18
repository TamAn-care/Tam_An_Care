---
type: domain-concept
created: 2026-09-02
updated: 2026-09-02
---

# Quy Chuẩn Cổng Thông Tin Thân Nhân & Người Bảo Hộ (Series Z — Family Portal)

## 1. Mục Đích & Nguyên Tắc Bảo Mật
- **Mục tiêu:** Cung cấp kênh tương tác minh bạch, ấm áp và chuyên nghiệp giữa Gia đình/Người bảo hộ và Viện dưỡng lão Tâm An.
- **Bảo mật phạm vi dữ liệu:** Thân nhân chỉ xem được dữ liệu của đúng người cao tuổi được liên kết/ủy quyền với tài khoản của mình (`GUARDIAN_ASSIGNMENTS`).

## 2. Các Phân Hệ Chức Năng Chính (`/family-portal`)
1. **Hồ Sơ & Tình Trạng Hiện Tại:**
   - Hiển thị tên cụ, mã cư dân, tuổi, phòng và giường ngủ (ví dụ: *Phòng 101 — Giường 101-2*).
   - Phân cấp chăm sóc (Cấp độ 1, 2, 3 hoặc Toàn diện).
   - Bác sĩ và Điều dưỡng phụ trách.
   - Trạng thái sinh hoạt thời gian thực (Đang tại Tâm An / Đang tạm vắng).

2. **Báo Cáo Sức Khỏe Định Kỳ & Tải PDF Chuẩn Y Khoa:**
   - Kết nối trực tiếp với phân hệ Báo cáo sức khỏe y khoa 3 trang (`health_reports`).
   - Tóm tắt lâm sàng nhanh: Huyết áp, mạch, SpO2, đường huyết đói, cân nặng, ADL, tinh thần và dặn dò y khoa.
   - Nút tải trực tiếp file PDF chính thức đã được Ban Giám đốc và Bác sĩ phê duyệt.

3. **Đăng Ký Nghỉ Phép / Tạm Vắng Trực Tuyến (RLA-BR-01):**
   - Form online dành riêng cho thân nhân đăng ký đón cụ về thăm nhà hoặc đi khám bệnh ngoài.
   - Đánh giá thời gian thực quy tắc 48h:
     - $\ge 48h$: Hợp lệ &rarr; Giảm trừ tiền ăn từ ngày vắng thứ 2.
     - $< 48h$: Ngày đầu vẫn tính phí do bếp đã lên thực đơn; từ ngày thứ 2 được giảm trừ theo quy định.
   - Theo dõi lịch sử và trạng thái xử lý đơn.

4. **Thực Đơn & Nhật Ký Sinh Hoạt Hàng Ngày:**
   - Chế độ ăn và dạng chế biến theo thời gian thực (Cơm mềm, Cháo dinh dưỡng, Xay nhuyễn, Sonde).
   - Thực đơn chi tiết 4 bữa trong ngày (Sáng, Trưa, Xế, Tối).
   - Lịch hoạt động thể chất, phơi nắng sáng và tập vật lý trị liệu phục hồi chức năng.

5. **Đặt Lịch Thăm Gặp Tại Tâm An:**
   - Đăng ký trước khung giờ thăm: Sáng (08:30 - 11:00) hoặc Chiều (14:30 - 17:00).
   - Địa điểm: Tại phòng nghỉ riêng của Cụ hoặc Sảnh vườn hoa Tâm An.
   - Giới hạn số lượng người thăm (tối đa 4 người) để đảm bảo không gian yên tĩnh cho các cụ.
