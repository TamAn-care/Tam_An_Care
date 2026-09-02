import type {
  PropsWithChildren,
} from 'react';

import {
  useActor,
} from './ActorContext';

export function RequireSupervisor({
  children,
}: PropsWithChildren) {
  const { actor } = useActor();

  if (!actor) {
    return null;
  }

  if (actor.actorRole === 'SUPERVISOR') {
    return <>{children}</>;
  }

  return (
    <section>
      <header className="page-header">
        <div className="eyebrow">
          Quyền truy cập
        </div>

        <h1 className="page-title">
          Không có quyền truy cập
        </h1>

        <p className="page-description">
          Chức năng này chỉ dành cho vai trò
          Giám sát.
        </p>
      </header>

      <div
        className="notice notice-warning"
        role="alert"
      >
        Backend vẫn thực hiện kiểm tra quyền
        độc lập. Việc ẩn hoặc khóa giao diện
        không thay thế RBAC của hệ thống.
      </div>
    </section>
  );
}
