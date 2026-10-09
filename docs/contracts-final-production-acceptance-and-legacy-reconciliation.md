# Tâm An — Hợp đồng dịch vụ: cổng nghiệm thu và chuyển đổi dữ liệu thật
Status: **NO-GO for Production Test deployment**. Source branch: `feature/finance-v22-github-build`.

## Quy trình nghiệp vụ duy nhất
1. Tiếp nhận: đối chiếu `resident_id`, phê duyệt mức chăm sóc và thông tin phòng–giường từ các phân hệ gốc.
2. Lập nháp hợp đồng trên backend chung. Không cho dữ liệu demo, mock hoặc hợp đồng từ `localStorage` được tự động chuyển thành hợp đồng.
3. Nhân viên được phân quyền đối chiếu **bản giấy đã ký** hoặc chữ ký xác thực bên ngoài. Mã SHA256 do trình duyệt cung cấp **chưa đủ** để chứng minh tài liệu đã được xác minh từ kho lưu trữ phía server.
4. Người phê duyệt độc lập xác minh người cao tuổi, mức chăm sóc, phòng/giường, đơn giá, dịch vụ bổ sung và khoản giảm trừ.
5. Kích hoạt đúng phiên bản hợp đồng; phiên bản đã ký không được ghi đè hoặc xóa. Finance chỉ sử dụng phiên bản có hiệu lực và đã phê duyệt.
6. Nếu thay đổi mức chăm sóc/giá sau tiếp nhận: tạo phiên bản nháp, xác nhận ký lại/điều chỉnh và duyệt độc lập trước khi có hiệu lực. Không tính lại hóa đơn kỳ đã phát hành nếu chưa có nghiệp vụ điều chỉnh có kiểm soát.

## Tiếp nhận hợp đồng cũ từ trình duyệt — chỉ khi có người phê duyệt
- **Không chạy migration tự động** từ `localStorage`, không xóa dữ liệu trình duyệt, không coi hợp đồng mock là thật.
- Trước tiên nhân viên có thẩm quyền phải kiểm kê trên từng thiết bị nguồn (không gửi CCCD/điện thoại/địa chỉ vào CI): số hồ sơ cần đối soát, tình trạng giấy ký và hợp đồng trùng mã.
- Mỗi hồ sơ thật phải được khớp thủ công theo `resident_id`, so với bản giấy/hồ sơ số, trạng thái hiệu lực, lịch sử phí và phụ lục; hồ sơ mơ hồ phải cách ly để rà soát.
- Người quản lý phê duyệt kết quả chuyển đổi trước khi tạo các bản ghi thật bằng backend có kiểm soát. Không tạo seed, dữ liệu giả, hoặc bản ghi chỉ vì tìm thấy `localStorage`.

## Kiểm tra bắt buộc trước nghiệm thu Production Test
- Bảng Finance/Contract chưa có trong kết quả audit metadata Production Test ngày 09/10/2026. Phải phê duyệt migration có backup và restore test.
- Cần xác định cơ chế lưu trữ và truy xuất **tệp đã ký thật**, kiểm tra hash **server-side** và phân quyền xem/xác nhận tài liệu. Hiện việc nộp hash từ frontend không đồng nghĩa chứng thực tài liệu.
- Xác minh JWT/session/role thực trên runtime (không dùng role header do trình duyệt tự đặt), phân quyền nhân viên lập nháp, kiểm tra bằng chứng, phê duyệt, đọc toàn trung tâm và truy cập từng người cao tuổi.
- Thử quy trình với hồ sơ thật **chỉ sau khi** cơ sở dữ liệu và nguồn hợp đồng được chuẩn bị đúng, có phê duyệt riêng. Không thử bằng seed/demo trên Production Test.
- Kiểm thử bất biến phiên bản, rollback giao dịch, chống trùng hợp đồng, dịch vụ/giảm trừ, thay đổi mức chăm sóc, đổi phòng/giường và ngăn phát hành doanh thu hai lần.

## Kết luận
- Các bài CI cô lập kiểm tra chính sách và transaction có thể PASS; điều này **không thay thế** nghiệm thu dữ liệu thật.
- `TAMANCARE_FINANCE_WRITE_ENABLED`, `TAMANCARE_CONTRACT_SIGNOFF_ENABLED`, `TAMANCARE_CONTRACT_DRAFT_WRITE_ENABLED` phải giữ tắt trong Production Test cho đến khi được phê duyệt riêng.
- NO DB reset; NO seed/demo; NO auto-migration; NO Docker volume change; NO production deployment.
