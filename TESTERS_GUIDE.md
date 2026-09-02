# Hướng Dẫn Cài Đặt & Chạy Thử Nghiệm Multi-Role — Tâm An Care V7.5

Tài liệu này hướng dẫn chi tiết cách cài đặt bản **Full Chức Năng Cài Đặt Được (Installable App)** của hệ thống **Viện Dưỡng Lão Tâm An Care V7.5** trên cả **4 nền tảng**: **iOS (iPhone/iPad)**, **Android**, **Windows PC** và **macOS**, tích hợp sẵn **100% dữ liệu chạy thử mẫu (Demo Data)** để các Testers đánh giá sản phẩm theo từng vai trò.

---

## 📱 1. HƯỚNG DẪN CÀI ĐẶT TRÊN CÁC THIẾT BỊ

### 🍏 A. iPhone & iPad (Hệ điều hành iOS / iPadOS)
1. Mở trình duyệt **Safari** trên iPhone/iPad và truy cập liên kết sản phẩm (Ví dụ: `http://<IP-May-Chu>:5173` hoặc domain của viện).
2. Nhấn vào biểu tượng **Chia sẻ (Share ⎋)** ở thanh công cụ dưới cùng Safari.
3. Cuộn xuống danh sách tùy chọn và chọn **"Thêm vào Màn hình chính" (Add to Home Screen ➕)**.
4. Nhấn **Thêm (Add)**. Biểu tượng ứng dụng **Tâm An Care** màu xanh lá sẽ xuất hiện trực tiếp trên Màn hình chính của iPhone/iPad và khởi chạy độc lập full-screen như ứng dụng App Store.

### 🤖 B. Điện Thoại & Máy Tính Bảng Android (Samsung, Xiaomi, Oppo...)
1. Mở trình duyệt **Google Chrome** trên thiết bị Android.
2. Nhấn vào nút **"📱 Cài Đặt App"** góc trên màn hình (hoặc bấm dấu **⋮ 3 chấm** góc phải trên Chrome &rarr; Chọn **"Cài đặt ứng dụng Tâm An Care..."**).
3. Nhấn **Cài đặt**. Ứng dụng sẽ được đóng gói dạng WebAPK và xuất hiện trong màn hình ứng dụng Android.

### 💻 C. Máy Tính Windows (Windows 10 / 11)
1. Mở trình duyệt **Microsoft Edge** hoặc **Google Chrome**.
2. Nhấn vào nút **"📱 Cài Đặt App"** ở góc phải thanh Topbar hệ thống.
3. Chọn **Cài đặt**. Ứng dụng sẽ chạy thành cửa sổ Desktop riêng biệt, tự tạo shortcut ngoài Desktop và Menu Start.

### 🍎 D. Máy Tính macOS (MacBook / iMac)
1. Mở trình duyệt **Safari** hoặc **Chrome** trên Mac.
2. Bấm nút **"📱 Cài Đặt App"** trên thanh tiêu đề.
3. Chọn **Cài đặt**. Icon Tâm An Care sẽ xuất hiện trong Launchpad và thanh Dock của macOS.

---

## 🧪 2. CHẾ ĐỘ TESTER & DANH SÁCH 14 TÀI KHOẢN CHẠY THỬ

Hệ thống được tích hợp sẵn nút **`🧪 Chế Độ Tester`** màu vàng trên góc phải Topbar (hoặc ở trang chủ). Bấm vào nút này để mở **Bảng Điều Khiển Chạy Thử Nghiệm Multi-Role**.

Testers có thể bấm nút **`⚡ Đăng Nhập Vai Trò Này`** để chuyển đổi ngay lập tức sang 1 trong 14 vai trò làm việc thực tế:

| STT | Vai Trò | Mã ID | Tên Nhân Sự | Phạm Vi Kiểm Thử |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Quản Trị Viên Tối Cao** | `Admin` | Quản Trị Viên (Admin) | Toàn quyền hệ thống, xem audit log, chuyển vai trò |
| **2** | **Ban Giám Đốc** | `STAFF-DIR-001` | Hà Quang Anh | Xem Dashboard chỉ đạo, duyệt hồ sơ tiếp nhận, xem báo cáo tổng hợp |
| **3** | **Quản Lý Vận Hành** | `STAFF-MGR-001` | Phạm Minh Đức | Quản lý lịch trực ca kíp, phân công nhân sự, duyệt đổi ca |
| **4** | **Điều Dưỡng Trưởng** | `STAFF-NUR-001` | Lê Thị Lan | Đánh giá sức khỏe ban đầu, lập tủ thuốc eMAR, kiểm tra sinh hiệu |
| **5** | **Điều Dưỡng Ca Trực** | `STAFF-NUR-003` | Trần Thị Bích | Theo dõi sinh hiệu, cấp phát thuốc, điểm danh ca trực & lập biên bản bàn giao |
| **6** | **Chăm Sóc Viên (Khu A)**| `cg-mai-001` | Trần Thị Mai | Ghi nhật ký ADL (ăn uống, tắm giặt, thay bỉm, trở mình) khu A |
| **7** | **Chăm Sóc Viên (Khu B)**| `cg-hoa-003` | Đặng Thị Hoa | Ghi nhận hoạt động sinh hoạt và chăm sóc các cụ khu B |
| **8** | **Chuyên Gia Dinh Dưỡng**| `STAFF-NUT-001` | Vũ Thị Dung | Bảng suất ăn kiêng y khoa, quản lý tồn kho bếp & hủy mẫu HACCP 24H |
| **9** | **Phòng Kế Toán** | `STAFF-ACC-001` | Hoàng Bích Ngọc | Quản lý hóa đơn lưu trú, chi phí y tế & viện phí người cao tuổi |
| **10**| **Lễ Tân Tiếp Đón** | `STAFF-REC-001` | Lê Thu Hà | Đăng ký khách thăm, hướng dẫn thân nhân & nhận đơn đăng ký |
| **11**| **Tư Vấn Tâm Lý** | `STAFF-PSY-001` | Nguyễn Thanh Nga | Đánh giá nhận thức, trí nhớ, trạng thái cảm xúc & trị liệu tinh thần |
| **12**| **Phục Hồi Chức Năng** | `STAFF-REH-001` | Nguyễn Văn Thành | Bài tập vật lý trị liệu, hỗ trợ vận động cho cụ sau đột quỵ |
| **13**| **Thân Nhân (Cụ An)** | `guardian-bao-001`| Lê Gia Bảo | Cổng thông tin thân nhân: Xem nhật ký, hình ảnh, hóa đơn & xin về nghỉ |
| **14**| **Thân Nhân (Cụ Bình)** | `guardian-duc-002`| Trần Anh Đức | Theo dõi sức khỏe và đóng góp ý kiến cho cụ Bình |

*Mật khẩu chạy thử chung cho tất cả tài khoản:* `123456` (Riêng tài khoản Admin là `Admin`).

---

## 🔄 3. KHÔI PHÚC DỮ LIỆU CHẠY THỬ MẪU (RESET DEMO DATA)

Trong quá trình testing, nếu dữ liệu bị thay đổi hoặc Testers muốn làm mới lại từ đầu:
1. Nhấn nút **`🧪 Chế Độ Tester`** trên Topbar.
2. Nhấn nút đỏ **`🔄 Khôi Phục Dữ Liệu Mẫu (Reset Demo Data)`**.
3. Toàn bộ 5 hồ sơ cư dân mẫu, ca trực, mẫu lưu HACCP và thông báo sẽ được đặt lại nguyên bản ban đầu.
