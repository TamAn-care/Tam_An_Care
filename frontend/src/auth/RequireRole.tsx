import type { PropsWithChildren } from 'react';
import { Link } from 'react-router-dom';
import { useActor } from './ActorContext';
import { canAccessRoute, type AppRouteKey, ROLE_LABELS } from './role-policy';

export function RequireRole({
  route,
  children,
}: PropsWithChildren<{ route: AppRouteKey }>) {
  const { actor } = useActor();

  if (!actor) {
    return null;
  }

  if (canAccessRoute(actor.actorRole, route)) {
    return <>{children}</>;
  }

  return (
    <section className="card" style={{ maxWidth: 640, margin: '3rem auto', textAlign: 'center', padding: '2.5rem 2rem' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛡️</div>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#991b1b', margin: '0 0 0.5rem 0' }}>
        Không Có Quyền Truy Cập
      </h2>
      <p style={{ color: '#64748b', fontSize: '0.95rem', margin: '0 0 1.5rem 0' }}>
        Tài khoản hiện tại với vai trò <b>{ROLE_LABELS[actor.actorRole] || actor.actorRole}</b> không được cấp quyền truy cập phân hệ này để đảm bảo bảo mật thông tin và không chồng chéo chức năng nhiệm vụ.
      </p>

      <div className="alert-card alert-info" style={{ textAlign: 'left', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
        <span>Vui lòng liên hệ Giám sát / Ban Giám đốc trung tâm nếu bạn cần phân công thẩm quyền xử lý.</span>
      </div>

      <Link to="/dashboard" className="btn btn-primary">
        &larr; Quay về Trang Tổng Quan
      </Link>
    </section>
  );
}
