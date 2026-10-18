---
type: domain-concept
created: 2026-09-01
updated: 2026-09-01
---

# Chuẩn Mực Lâm Sàng, Dinh Dưỡng & Thuật Ngữ — Trung Tâm Dưỡng Lão Tâm An

## 1. Ba Mức Độ Chăm Sóc Chuẩn Y Tế Toàn Viện
Mọi phân hệ trong toàn bộ app thống nhất đúng 03 mức độ chăm sóc:
1. **`(1) Tự phục vụ cơ bản`** (`LEVEL_1` / `INDEPENDENT`)
2. **`(2) Cần hỗ trợ một phần`** (`LEVEL_2` / `ASSISTED` / `PARTIAL_ASSIST`)
3. **`(3) Cần chăm sóc toàn diện`** (`LEVEL_3` / `HIGH_ASSISTANCE` / `DEPENDENT` / `COMPREHENSIVE`)

## 2. Quy Chuẩn Dinh Dưỡng & Quản Lý Suất Ăn Hàng Ngày (Nhân Viên Dinh Dưỡng)
1. **Số lượng suất ăn nội trú thực tế:** Tự động đồng bộ từ tổng số người cao tuổi nội trú trừ đi những người đang có trạng thái `ACTIVE_LEAVE` (Tạm vắng theo quy tắc RLA-BR-01).
2. **Dạng chế biến suất ăn chuẩn:**
   - 🍚 **Cơm mềm / Cơm thường:** Dành cho người cao tuổi răng còn khỏe, tự xúc ăn tốt.
   - 🥣 **Nấu nhừ / Băm nhỏ / Cháo hạt:** Dành cho người nhai yếu, tiêu hóa chậm.
   - 🍲 **Xay nhuyễn / Súp dinh dưỡng:** Dành cho người suy kiệt, liệt hoặc khó nuốt.
   - 🧪 **Ăn qua ống Sonde (Ống thông dạ dày):** Dành cho bệnh nhân hôn mê hoặc tai biến nặng (5 cữ súp chuyên biệt/ngày).
3. **Chế độ bệnh lý dinh dưỡng đặc thù:**
   - Đái tháo đường: Kiêng đường tinh luyện, kiểm soát tinh bột, bổ sung chất xơ.
   - Tăng huyết áp / Tim mạch: Ăn nhạt (muối < 3g/ngày), hạn chế mỡ động vật.
   - Suy thận: Giảm đạm, hạn chế thực phẩm giàu kali & photpho.
   - Dị ứng thực phẩm: Kiêng tôm, cua, đậu phộng theo hồ sơ y bạ.
4. **Suất ăn bổ sung / Khách:** Hỗ trợ đăng ký suất ăn cho thân nhân đến thăm dùng cơm cùng cụ, suất ăn ca kíp cho nhân viên y tế và nhân viên chăm sóc.

## 3. Quy Chuẩn Thuật Ngữ & Biểu Mẫu
- Dùng **`Trở lại Tâm An`** thay vì *Trở lại viện*.
- Dùng **`Người cao tuổi`** hoặc **`Cư dân`** thay vì *Bệnh nhân*.
- Dùng **`Đang sử dụng`** và **`Còn trống`** cho trạng thái giường bệnh.
- **Phiếu Đánh Giá Sức Khỏe Ban Đầu (`/admissions`):** 2 trang chuẩn y khoa.
- **Phiếu Báo Cáo Sức Khỏe Định Kỳ (`/health-reports`):** 3 trang PDF A4 gửi gia đình định kỳ.
