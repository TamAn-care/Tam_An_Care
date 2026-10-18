---
type: domain-concept
created: 2026-09-01
updated: 2026-09-01
---

# Quy Chuẩn Phân Quyền 12 Vị Trí Việc Làm & Bảo Mật Phạm Vi (RBAC)

## 1. Danh Mục 12 Vị Trí Việc Làm Chuẩn Hóa
1. **`SUPERVISOR`** — **Ban Giám đốc**: Toàn quyền điều hành và quản trị hệ thống.
2. **`CARE_MANAGER`** — **Quản lý**: Quản lý chung tất cả các hoạt động của Trung tâm, duyệt tạm vắng, phân ca, phê duyệt suất ăn bổ sung.
3. **`PSYCHOLOGIST`** — **Nhân viên tâm lý**: Trị liệu tâm lý, đánh giá nhận thức MMSE, hành vi người cao tuổi.
4. **`SOCIAL_WORKER`** — **Nhân viên công tác xã hội**: Tiếp nhận ban đầu, kết nối gia đình, hỗ trợ hòa nhập cộng đồng.
5. **`NURSE`** — **Nhân viên y tế**: Quản lý y lệnh, cấp phát thuốc, đo sinh tồn, lập phiếu đánh giá sức khỏe định kỳ.
6. **`CAREGIVER`** — **Nhân viên chăm sóc**: Chăm sóc trực tiếp (ADL), vệ sinh, ăn uống, điểm danh ca trực, báo cáo & đăng ký suất ăn cho các cụ được phân quyền phụ trách.
7. **`NUTRITIONIST`** — **Nhân viên dinh dưỡng**: Phụ trách bếp và chế độ dinh dưỡng, tổng hợp suất ăn và dạng chế biến theo thời gian thực.
8. **`HOUSEKEEPING`** — **Nhân viên tạp vụ**: Vệ sinh phòng ốc, giặt ủi, khử khuẩn môi trường lưu trú.
9. **`REHABILITATION_SPECIALIST`** — **Nhân viên phục hồi chức năng**: Vật lý trị liệu, tập vận động, phục hồi chức năng sau tai biến.
10. **`SECURITY`** — **Bảo vệ**: An ninh trật tự, kiểm soát cổng ra vào, bảo vệ an toàn toàn viện.
11. **`ACCOUNTANT`** — **Kế toán**: Thu chi viện phí, quản lý định mức tài chính, bảo hiểm y tế.
12. **`RECEPTIONIST`** — **Nhân viên lễ tân**: Đón tiếp khách, hướng dẫn thân nhân thăm nuôi, hỗ trợ thủ tục ban đầu.

## 2. Nguyên Tắc Bảo Mật Phạm Vi Chăm Sóc Cho Nhân Viên Chăm Sóc (`CAREGIVER`)
1. **Phân quyền theo phạm vi cư dân được giao phụ trách (Row-Level Security):**
   - Nhân viên chăm sóc chỉ thấy và chỉ thao tác với đúng danh sách Người cao tuổi được phân công trực tiếp (thông qua bảng `resident_access_assignments`).
2. **Bảo mật thông tin vĩ mô / tổng quan của Trung tâm:**
   - Ẩn hoàn toàn các chỉ số vĩ mô quản trị (Tổng số giường 110 giường, công suất lấp đầy phòng %, danh sách tài chính, sơ đồ tổng thể toàn viện).
   - Menu của Nhân viên chăm sóc chỉ gồm các phân hệ nghiệp vụ trực tiếp: `Tổng quan`, `Người cao tuổi (Chỉ các cụ phụ trách)`, `Vận hành chăm sóc`, `Lịch trực & Ca kíp`, `Trạng thái hệ thống`.
3. **Bảng Điều Khiển Ca Trực (`/dashboard`) cá nhân hóa:**
   - Hiển thị số lượng cụ bạn phụ trách, ca trực trong ngày, nhật ký ghi nhận chăm sóc ca và biểu mẫu cập nhật suất ăn cho bếp.

## 3. Nguyên Tắc Phân Quyền Lập Báo Cáo Sức Khỏe Định Kỳ
1. **Chỉ Nhân viên y tế (`NURSE`) có quyền lập mới phiếu:**
   - Đảm bảo tính chính xác và tuân thủ chuyên môn y khoa (sinh hiệu, bệnh lý, thuốc, thang điểm ADL, thần kinh, dinh dưỡng).
2. **Quản lý (`CARE_MANAGER`) & Ban Giám đốc (`SUPERVISOR`):**
   - Phụ trách rà soát, ký duyệt chuyên môn (`Phê duyệt`), gửi báo cáo cho gia đình (`Gửi gia đình`) và xem/in ấn phiếu chuẩn y khoa (không lập mới phiếu đánh giá).

## 4. Phân Quyền Menu Ca Kíp & Tùy Biến Bảng Tổng Quan (`/dashboard`)
1. **Menu Lịch Trực & Ca Kíp (`/workforce`):**
   - Bổ sung menu Ca kíp cho tất cả các vị trí: `NUTRITIONIST` (Nhân viên dinh dưỡng), `SOCIAL_WORKER` (Nhân viên công tác xã hội), `REHABILITATION_SPECIALIST` (Nhân viên phục hồi chức năng / vật lý trị liệu), `PSYCHOLOGIST`, `ACCOUNTANT`, `RECEPTIONIST`, `CAREGIVER`, `HOUSEKEEPING`, `SECURITY`.
   - Nhân viên chỉ thấy lịch ca kíp của chính mình để chủ động quản lý; chỉ Quản lý và Ban Giám đốc mới có quyền xếp ca và xem toàn bộ nhân sự.
2. **Tùy biến Bảng Tổng Quan (`/dashboard`):**
   - Không hiển thị "Phiếu đánh giá sức khỏe" cho các vị trí phi lâm sàng (`NUTRITIONIST`, `SOCIAL_WORKER`, `REHABILITATION_SPECIALIST`, `CAREGIVER`, `HOUSEKEEPING`, `SECURITY`, `ACCOUNTANT`, `RECEPTIONIST`).
   - Từng vị trí được hiển thị 3 thẻ điều hướng chuyên môn phù hợp với nghiệp vụ thực tế (Dinh dưỡng & Bếp, Tiếp nhận xã hội, Vật lý trị liệu, v.v.).

## 5. Nguyên Tắc Bảo Mật Thông Tin Giảm Trừ Tiền Ăn (RLA-BR-01)
1. **Thẩm quyền tiếp cận thông tin tài chính giảm trừ tiền ăn:**
   - **Chỉ 3 vị trí được phép xem:** `SUPERVISOR` (Ban Giám đốc), `ACCOUNTANT` (Kế toán trưởng / Kế toán), và `CARE_MANAGER` (Quản lý).
2. **Ẩn đối với toàn bộ các vị trí việc làm khác:**
   - Tại phân hệ **Nghỉ phép & Tạm vắng (`/resident-leave`)**: Ẩn hoàn toàn cột "Giảm trừ tiền ăn", nhãn "Tính phí ngày đầu", thẻ KPI tài chính và giải thích quy tắc giảm trừ tiền ăn đối với các vị trí: `CAREGIVER`, `NURSE`, `NUTRITIONIST`, `SOCIAL_WORKER`, `PSYCHOLOGIST`, `REHABILITATION_SPECIALIST`, `HOUSEKEEPING`, `SECURITY`, `RECEPTIONIST`.
   - Các nhân viên này chỉ tiếp cận thông tin nghiệp vụ: thời gian vắng mặt, người bảo hộ, lý do và thời điểm người cao tuổi trở lại Tâm An.

## 6. Nguyên Tắc Phân Quyền Tiếp Cận Thông Tin Suất Ăn & Đăng Ký Suất Ăn
1. **Nhóm 5 vị trí được phân quyền tiếp cận bảng điều phối suất ăn (`NutritionBoard`):**
   - **Ban Giám đốc** (`SUPERVISOR`): Giám sát vĩ mô, phê duyệt suất ăn bổ sung cho khách & thân nhân.
   - **Quản lý** (`CARE_MANAGER`): Điều hành, phê duyệt và đăng ký suất ăn bổ sung cho khách & thân nhân.
   - **Nhân viên chăm sóc** (`CAREGIVER`): Báo cáo, đăng ký và cập nhật suất ăn cho đúng các cụ được giao phụ trách.
   - **Nhân viên y tế** (`NURSE`): Theo dõi chế độ ăn bệnh lý (tiểu đường, kiêng muối, ăn qua sonde, xay nhuyễn) theo y lệnh lâm sàng.
   - **Nhân viên dinh dưỡng** (`NUTRITIONIST`): Bảng điều phối bếp, tiếp nhận tổng hợp số lượng, dạng chế biến và phân bổ suất ăn.
2. **Ẩn hoàn toàn thông tin suất ăn đối với các vị trí còn lại (7 vị trí):**
   - Không hiển thị bảng điều phối dinh dưỡng (`NutritionBoard`) trên trang chủ đối với: `SOCIAL_WORKER`, `PSYCHOLOGIST`, `REHABILITATION_SPECIALIST`, `HOUSEKEEPING`, `SECURITY`, `ACCOUNTANT`, `RECEPTIONIST`.

## 7. Nguyên Tắc Phân Quyền Quản Lý Dược Phẩm (eMAR) & Tồn Kho Y Tế (Series AD)
1. **Phân chia thuốc (theo đơn Bác sĩ):**
   - **Độc quyền Nhân viên y tế (`NURSE`)**: Chỉ Nhân viên y tế mới có quyền phân chia thuốc, tạo y lệnh và cập nhật liều dùng.
2. **Cho uống thuốc & Ký xác nhận eMAR:**
   - **Trách nhiệm của Điều dưỡng / Nhân viên y tế (`NURSE`)**: Cho các cụ uống thuốc đúng cữ, đúng giờ (chuẩn 5 Đúng) và ký xác nhận thời gian thực trên eMAR (hoặc ghi nhận lý do tạm hoãn/từ chối).
3. **Truy xuất & Quản lý Kho vật tư y tế:**
   - **Nhân viên y tế (`NURSE`)**: Có quyền truy xuất kho vật tư, nhập bổ sung và xuất sử dụng cho từng Cụ / phòng ban.
   - **Quản lý (`CARE_MANAGER`)**: Có quyền truy xuất quản lý kho vật tư phục vụ mục tiêu quản trị, điều phối và kiểm soát định mức.
4. **Quyền hạn của Ban Giám đốc (`SUPERVISOR`):**
   - Có đầy đủ quyền xem toàn diện tất cả các phân hệ (eMAR, Y lệnh, Kho vật tư, Nhật ký) để phục vụ công tác quản lý, điều hành và giám sát chất lượng chăm sóc.
5. **Chặn quyền đối với Nhân viên phục hồi chức năng & các vị trí khác:**
   - **Nhân viên phục hồi chức năng (`REHABILITATION_SPECIALIST`)**: Tuyệt đối **KHÔNG** có quyền hỗ trợ các cụ uống thuốc và không có quyền truy cập nghiệp vụ dược phẩm.
   - **Kế toán (`ACCOUNTANT`)**: Chỉ xem nhật ký chi phí vật tư và thuốc để đối soát viện phí (`Series AC`).

## 8. Nguyên Tắc Phân Quyền Thẻ "Chăm Sóc & Vận Hành" (`/operations`)
1. **Thẩm quyền Tổng hợp Vĩ mô (Admin, Ban Giám đốc & Quản lý chung):**
   - **Các vị trí:** `ADMIN`, `SUPERVISOR` (Ban Giám đốc), `CARE_MANAGER` (Quản lý).
   - **Quyền hạn:** Tổng hợp, xem và rà soát toàn bộ các hoạt động chăm sóc của **tất cả 8 khối chuyên môn** (Chăm sóc cá nhân, Dinh dưỡng, Y tế/Lâm sàng, Vận động/VLTL, Tâm lý - Xã hội, Vệ sinh, Khẩn cấp, Khác). Có đầy đủ quyền lọc đa chiều hoặc xóa bộ lọc để xem 100% nhật ký vận hành.
2. **Phân quyền Phạm vi Chuyên môn cho Nhân viên phụ trách cụ thể:**
   - **Nhân viên tâm lý (`PSYCHOLOGIST`) & Nhân viên công tác xã hội (`SOCIAL_WORKER`)**: Form *Ghi nhận công việc chăm sóc* chỉ tập trung vào các hoạt động Tâm lý - Xã hội (`PSYCHOSOCIAL`). *Bảng Tổng hợp hoạt động chăm sóc* mặc định chỉ tổng hợp & hiển thị kết quả liên quan đến công tác tâm lý - xã hội người cao tuổi.
   - **Nhân viên y tế (`NURSE`)**: Tập trung vào Khối Y tế & Lâm sàng (`CLINICAL_CARE`).
   - **Nhân viên chăm sóc (`CAREGIVER`)**: Tập trung vào Chăm sóc cá nhân & ADL (`PERSONAL_CARE`).
   - **Nhân viên phục hồi chức năng (`REHABILITATION_SPECIALIST`)**: Tập trung vào Vận động & Phục hồi chức năng (`MOBILITY`).
   - **Nhân viên dinh dưỡng (`NUTRITIONIST`)**: Tập trung vào Dinh dưỡng & Bữa ăn (`NUTRITION`).
   - **Nhân viên tạp vụ (`HOUSEKEEPING`)**: Tập trung vào Vệ sinh & Buồng phòng (`HOUSEKEEPING`).

