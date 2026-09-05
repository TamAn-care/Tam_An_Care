import { useQuery } from '@tanstack/react-query';
import { getHealth, HealthResponse } from '../../api/health';

export function ConnectivityStatus() {
  const health = useQuery<HealthResponse>({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 30000,
    retry: 1,
  });

  const isOnlineMode = health.data?.mode === 'online';
  const isStandaloneMode = health.data?.mode === 'standalone';
  const isConnected = health.isSuccess && (isOnlineMode || isStandaloneMode);

  return (
    <div
      className={isConnected ? 'status online' : 'status offline'}
      role="status"
      title={
        isOnlineMode
          ? 'Hệ thống đang kết nối trực tiếp với Máy chủ API NestJS'
          : isStandaloneMode
          ? 'Hệ thống đang hoạt động ở Chế độ Độc lập (Standalone / Offline Local Engine)'
          : 'Không kết nối được hệ thống'
      }
    >
      <span className="status-dot" aria-hidden="true" />
      <span>
        {health.isPending
          ? 'Đang kiểm tra hệ thống'
          : isConnected
          ? isOnlineMode
            ? 'Hệ thống đang hoạt động'
            : 'Hệ thống đang hoạt động (Ngoại tuyến)'
          : 'Không kết nối được hệ thống'}
      </span>
    </div>
  );
}
