# Viện Dưỡng Lão Tâm An Care V7.5 — Progressive Web App & Enterprise Management

**Tâm An Care V7.5** là Hệ thống Quản trị & Vận hành Viện Dưỡng Lão toàn diện, hỗ trợ quản lý cư dân, tiếp nhận y khoa ban đầu, kế hoạch chăm sóc hàng ngày (ADL/eMAR), dinh dưỡng & bếp ăn HACCP, phân công nhân sự và báo cáo chỉ đạo dành cho Ban Giám đốc.

---

## 🌟 TÍNH NĂNG VÀ NÂNG CẤP CHÍNH TRONG PHIÊN BẢN V7.5

### 1. 📊 Executive Command Center (Dashboard Ban Giám Đốc)
- Tích hợp giao diện chỉ đạo trực quan dành riêng cho Ban Giám đốc và Quản lý.
- Hiển thị 5 nhóm chỉ số chỉ đạo thời gian thực: *Số hồ sơ tiếp nhận chờ duyệt, Cư dân tạm vắng/tạm về, Ca phân công nhân sự đang trực, Cảnh báo y tế*.

### 2. 🥗 Báo Cáo Tồn Kho & Hủy Mẫu HACCP 24H (Bếp Ăn & Dinh Dưỡng)
- Quản lý kho thực phẩm tươi và thực đơn theo dạng chế biến (*Cơm mềm, Cháo, Xay nhuyễn, Sonde*).
- Nút **`📥 Xuất Báo Cáo Tồn Kho Excel/CSV`** không lỗi font Tiếng Việt (UTF-8 BOM).
- Tự động đếm giờ và phát thông báo **Hủy mẫu an toàn 24H** tại tủ mát lưu mẫu.

### 3. 📜 Lịch Sử Phiếu Tiếp Nhận Thuốc & Đồ Dùng Cá Nhân (A4 Print Ready)
- Lưu vết toàn bộ phiếu bàn giao tư trang và thuốc cá nhân của người cao tuổi lúc tiếp nhận.
- Tra cứu lịch sử bàn giao và in phiếu A4 chuẩn y khoa bộ 3 chữ ký (*Thân nhân bàn giao — Điều dưỡng tiếp nhận — Quản lý xác nhận*).

### 4. 🛡️ CareView Gate — Bảo Mật Nhật Ký Chăm Sóc Theo Phân Công
- Màn hình khóa bảo mật 🔒 ngăn chặn truy cập trái phép vào nhật ký chăm sóc y khoa và eMAR nếu nhân viên chưa được Ban Giám đốc cấp quyền phụ trách cư dân đó.

### 5. 🔔 Hệ Thống Thông Báo Nội Bộ Realtime (In-App Notification Bell)
- **Soạn & Phát thông báo thủ công**: Ban Giám đốc & Quản lý phát thông báo chỉ đạo tới toàn thể nhân sự trực tiếp từ menu chuông 🔔 Topbar.
- **Kích hoạt tự động**: Tự động phát cảnh báo khi có phân công mới, nhắc hủy mẫu HACCP 24H, hoặc sinh hiệu bất thường (> 37.5°C).

### 6. 📥 Xuất Báo Cáo CSV / Excel UTF-8 BOM Hàng Loạt
- Tích hợp bộ xuất báo cáo dữ liệu định dạng CSV chuẩn UTF-8 BOM (`\uFEFF`) mở trực tiếp trên Excel không lỗi font tại 4 phân hệ: *Quản lý Nhân sự*, *Phân công Phụ trách*, *Hồ sơ Cư dân*, *Lịch trực & Ca kíp*.

### 7. 📱 Hỗ Trợ Cài Đặt Trực Tiếp (Installable PWA)
- Tích hợp `manifest.json`, Service Worker (`sw.js`) và nút **`📱 Cài Đặt App`** ở Topbar.
- Cho phép cài đặt ứng dụng chạy độc lập full-screen trên iPhone, iPad, Android, macOS và Windows PC mà không cần qua App Store.

### 8. 🔒 Khóa Bảo Mật Quyền Đăng Nhập & Phân Lập Vai Trò
- Ẩn hoàn toàn thanh chuyển vai trò nhân sự đối với các tài khoản không phải Admin.
- Đảm bảo mỗi nhân viên chỉ truy cập đúng tài khoản và phạm vi công việc được phân công.

### 9. 🧭 Bộ Nút Điều Hướng "Quay Lại / Tiếp Tục"
- Tích hợp nút **`◀ Quay lại`** và **`Tiếp tục ▶`** tại thanh tiêu đề Topbar và chân các biểu mẫu multi-step.

---

## 💻 HƯỚNG DẪN KHỞI CHẠY (LOCAL QUICK START)

### 1. Khởi chạy Frontend (React + Vite + TypeScript)
```bash
cd frontend
npm install
npm run dev
```
Truy cập trình duyệt: [http://127.0.0.1:5173](http://127.0.0.1:5173)

### 2. Kiểm tra & Build Sản Phẩm
```bash
cd frontend
npm run build
```

---

## 🐙 HƯỚNG DẪN ĐẨY MÃ NGUỒN LÊN GITHUB

Toàn bộ mã nguồn và lịch sử commit cục bộ đã được chuẩn bị sẵn sàng. Để đẩy lên GitHub của bạn:

1. Tạo một repository mới trên GitHub (Ví dụ: `tam-an-care`).
2. Mở Terminal tại thư mục dự án và chạy 2 lệnh:
```bash
git remote add origin https://github.com/YOUR_USERNAME/tam-an-care.git
git push -u origin main
```
# Tam_An_Care
