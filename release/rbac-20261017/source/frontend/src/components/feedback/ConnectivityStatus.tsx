import { useQuery } from '@tanstack/react-query';
import { getHealth, HealthResponse } from '../../api/health';

interface ConnectivityStatusProps {
  isCollapsed?: boolean;
}

export function ConnectivityStatus({ isCollapsed = false }: ConnectivityStatusProps) {
  const health = useQuery<HealthResponse>({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 30000,
    retry: 1,
  });

  const isOnlineMode = health.data?.mode === 'online';
  const isStandaloneMode = health.data?.mode === 'standalone';
  const isConnected = health.isSuccess && (isOnlineMode || isStandaloneMode);

  const statusText = health.isPending
    ? 'Đang kiểm tra hệ thống...'
    : isConnected
    ? isOnlineMode
      ? 'Hệ thống đang hoạt động'
      : 'Hệ thống đang hoạt động (Ngoại tuyến)'
    : 'Không kết nối được hệ thống';

  return (
    <div
      className={isConnected ? 'status online' : 'status offline'}
      role="status"
      title={statusText}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        fontSize: '0.72rem',
        fontWeight: 600,
        color: isConnected ? '#15803d' : '#b91c1c',
        padding: isCollapsed ? '0.3rem 0' : '0.3rem 0.5rem',
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        background: isCollapsed ? 'transparent' : '#f8fafc',
        borderRadius: '0.375rem',
        border: isCollapsed ? 'none' : '1px solid #e2e8f0',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <span className="status-dot" style={{ width: '7px', height: '7px', borderRadius: '50%', background: isConnected ? '#22c55e' : '#ef4444', flexShrink: 0 }} aria-hidden="true" />
      {!isCollapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{statusText}</span>}
    </div>
  );
}
