---
type: domain-concept
created: 2026-09-02
updated: 2026-09-02
---

# Quy Chuẩn Vận Hành Chăm Sóc & Thao Tác An Toàn Hệ Thống

## 1. Danh Mục Phân Loại Loại Hình Công Việc Phát Sinh (`/operations`)
1. **Chăm sóc cá nhân & Sinh hoạt (`PERSONAL_CARE`):**
   - `Tắm rửa & Vệ sinh thân thể` (`HYGIENE_BATHING`)
   - `Thay tã bỉm & Vệ sinh bài tiết` (`DIAPER_TOILETING`)
2. **Dinh dưỡng & Bữa ăn (`NUTRITION`):**
   - `Hỗ trợ ăn uống & Bón cháo/cơm` (`MEAL_ASSISTANCE`)
   - `Hỗ trợ ăn qua ống thông Sonde` (`TUBE_FEEDING_ASSIST`)
3. **Y tế & Theo dõi sức khỏe (`CLINICAL_CARE`):**
   - `Đo dấu hiệu sinh tồn & Huyết áp` (`VITAL_SIGNS_CHECK`)
   - `Cấp phát & Cho uống thuốc theo y lệnh` (`MEDICATION_ADMINISTRATION`)
   - `Thay băng & Chăm sóc vết thương/loét` (`WOUND_CARE`)
4. **Vận động & Phục hồi chức năng (`MOBILITY`):**
   - `Hỗ trợ di chuyển & Đổi tư thế chống loét` (`MOBILITY_ASSISTANCE`)
   - `Hướng dẫn tập VLTL & Phục hồi chức năng` (`REHAB_EXERCISE`)
5. **Tâm lý & Xã hội (`PSYCHOSOCIAL`):**
   - `Trò chuyện & Tham vấn tâm lý tinh thần` (`PSYCHOLOGICAL_SUPPORT`)
   - `Đánh giá nhận thức MMSE / MoCA & Trầm cảm GDS` (`COGNITIVE_ASSESSMENT_MMSE`)
   - `Liệu pháp Ký ức (Reminiscence Therapy) & Trị liệu nhóm` (`REMINISCENCE_THERAPY`)
   - `Hỗ trợ tâm lý thích ứng khi mới vào viện / Giải tỏa khủng hoảng` (`RELOCATION_ADAPTATION_SUPPORT`)
   - `Tổ chức sinh hoạt nhóm, CLB & Sự kiện giao lưu cộng đồng` (`SOCIAL_GROUP_ACTIVITY`)
   - `Tham vấn & Hỗ trợ gắn kết tình cảm Thân nhân - Người cao tuổi` (`FAMILY_RELATIONSHIP_CONNECT` / `FAMILY_VISIT_ASSIST`)
   - `Đánh giá nhu cầu trợ giúp xã hội & Bảo vệ quyền lợi cụ` (`SOCIAL_WORK_ADMISSION`)
6. **Vệ sinh buồng phòng & Sự cố (`HOUSEKEEPING` / `EMERGENCY`):**
   - `Dọn dẹp phòng & Thay drap giường đột xuất` (`ROOM_CLEANING_INCIDENTAL`)
   - `Xử lý sự cố / Sơ cứu khẩn cấp` (`EMERGENCY_INCIDENT_CARE`)
7. **Nghiệp vụ phát sinh khác (`OTHER`):**
   - `Khác (Diễn giải chi tiết tại phần Ghi chú)` (`OTHER_INCIDENTAL`)

## 2. Quy Tắc Xử Lý Lựa Chọn "Khác"
- **Cảnh báo tương tác:** Khi người dùng chọn loại hình công việc "Khác", hệ thống hiển thị cảnh báo nhắc nhở màu vàng.
- **Bắt buộc diễn giải:** Ô Ghi chú đổi thành `Ghi chú * (Bắt buộc diễn giải cho loại Khác)` kèm viền màu cam.
- **Validation:** Bắt buộc người dùng phải nhập diễn giải chi tiết công việc cụ thể đã thực hiện, chặn gửi form nếu để trống.

## 3. Quy Chuẩn An Toàn Khi "Trả Giường" (`/accommodation`)
- **Hộp thoại xác nhận bắt buộc:** Khi bấm nút "Trả giường", không giải phóng giường ngay mà phải bật popup xác nhận.
- **Thông tin định danh:** Hiển thị rõ tên người cao tuổi, mã giường, số phòng và tầng.
- **Khẳng định rõ ràng:** Nhắc nhở người dùng "Bạn có chắc chắn muốn Trả giường? Trạng thái giường sẽ chuyển thành Còn trống và sẵn sàng tiếp nhận người cao tuổi mới."

## 4. Chuẩn Hóa Thuật Ngữ Viện Dưỡng Lão Tâm An
- **Tuyệt đối không dùng từ "viện" đơn lẻ** trên toàn bộ giao diện, tài liệu, nhãn hiển thị và báo cáo.
- **Thay thế bằng:** "Tâm An" hoặc "Trung tâm".
- **Ví dụ chuẩn hóa:**
  - *"Vào viện"* &rarr; **`Vào Tâm An`**
  - *"Đã vào viện"* &rarr; **`Đã vào Tâm An`**
  - *"Trạng thái tại viện hôm nay"* &rarr; **`TRẠNG THÁI TẠI TÂM AN HÔM NAY`**
  - *"ĐÃ VÀO TÂM AN CHÍNH THỨC"*
  - *"ASSESSMENT_COMPLETED"* &rarr; **`Đã hoàn thành đánh giá`**
