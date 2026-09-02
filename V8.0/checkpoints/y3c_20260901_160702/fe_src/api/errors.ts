export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function vietnameseApiMessage(
  status: number,
): string {
  switch (status) {
    case 400:
      return 'Dữ liệu gửi lên chưa hợp lệ. Vui lòng kiểm tra lại.';
    case 401:
      return 'Phiên làm việc chưa được xác định. Vui lòng đăng nhập lại.';
    case 403:
      return 'Bạn không có quyền thực hiện thao tác này.';
    case 404:
      return 'Không tìm thấy dữ liệu phù hợp hoặc bạn không có quyền truy cập.';
    case 409:
      return 'Dữ liệu hiện tại xung đột với thao tác này. Vui lòng kiểm tra lại.';
    default:
      return 'Hệ thống gặp lỗi khi xử lý yêu cầu.';
  }
}
