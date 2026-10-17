# RBAC runtime source binding — 17/10/2026

Snapshot phục vụ review và truy vết RC đã chạy trên Production Test. Commit chứa snapshot này được tạo **sau** deployment; không khẳng định image cũ đã được build từ commit mới.

Source API build đủ 199 module; 27 module overlay build lại khớp byte với manifest và runtime. Source frontend Health Sync đã ghép RBAC build lại khớp cả 15 file overlay đang phục vụ. Phần frontend này khác frontend Guardian độc lập trong checkpoint cũ.

`binding.json` ghi base SHA, image IDs, archive hashes và hash từng file source. `evidence/` chứa checksum runtime, không chứa dữ liệu cư dân hay credentials. Chạy `python3 verify.py` để kiểm tra snapshot; sau khi build hai thư mục `source/api` và `source/frontend`, chạy `python3 verify.py --rebuilt` để đối chiếu output. Trong phiên xác minh đã dùng dependency cache hiện hữu, không chạy npm install. Package/lock của frontend merge và cấu hình dependency cache hiệu lực đều được giữ để review; chưa chứng nhận clean-install build trong môi trường mới.

Đây là ứng dụng dẫn xuất từ base images Health Sync ghi trong manifest. Chỉ 27 module API và 15 file frontend đã được đối chiếu với RC; không được thay toàn bộ runtime bằng output API của snapshot. Không có chứng nhận source của các module Finance/Nutrition còn lại trong base image. Hai script chuẩn bị overlay lưu trong `artifacts/` là bản lưu lịch sử, còn dùng layout checkpoint cũ.

API/frontend build lại PASS. Bằng chứng kiểm thử đã có: 102 test local PASS và 21 test HTTP dùng database bộ nhớ trên server cô lập PASS; 11 test frontend Guardian PASS. PostgreSQL integration 57/57 và rollback drill là bằng chứng lịch sử, chưa chạy lại trong lượt này. GitHub Actions của base SHA thành công; chưa có CI cho commit snapshot mới.

Nghiệm thu Production Test còn chờ tài khoản kiểm thử được cấp quyền, phương thức truy cập an toàn và mục tiêu ghi đã được phê duyệt không làm thay đổi hồ sơ thật. Chưa chứng nhận Care Manager, phiếu tâm lý ban đầu hoặc Finance/Nutrition end-to-end trên runtime vận hành. Không tạo tài khoản, không giả mạo JWT, không đổi quyền, không tạo dữ liệu giả trong Production Test.

Không deploy, migration, restart PostgreSQL hoặc thay volume trong lượt chốt snapshot. Các thay đổi trong worktree Guardian ban đầu được giữ nguyên. Chưa push commit hoặc sửa PR.
