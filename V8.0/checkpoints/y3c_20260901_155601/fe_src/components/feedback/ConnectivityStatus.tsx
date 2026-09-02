import {
  useQuery,
} from '@tanstack/react-query';

import {
  getHealth,
} from '../../api/health';

export function ConnectivityStatus() {
  const health =
    useQuery({
      queryKey: ['health'],
      queryFn: getHealth,
      refetchInterval: 30000,
      retry: 0,
    });

  const online =
    health.isSuccess;

  return (
    <div
      className={
        online
          ? 'status online'
          : 'status offline'
      }
      role="status"
    >
      <span
        className="status-dot"
        aria-hidden="true"
      />

      <span>
        {health.isPending
          ? 'Đang kiểm tra hệ thống'
          : online
            ? 'Hệ thống đang hoạt động'
            : 'Không kết nối được hệ thống'}
      </span>
    </div>
  );
}
