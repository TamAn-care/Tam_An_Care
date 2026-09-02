import type {
  PropsWithChildren,
} from 'react';

import {
  useLocation,
} from 'react-router-dom';

import {
  useActor,
} from './ActorContext';

import {
  DevelopmentActorPanel,
} from './DevelopmentActorPanel';

export function RequireActor({
  children,
}: PropsWithChildren) {
  const { actor } = useActor();
  const location = useLocation();

  if (actor) {
    return <>{children}</>;
  }

  return (
    <section style={{ maxWidth: '1000px', margin: '0 auto', paddingTop: '1rem' }}>
      <header className="page-header" style={{ marginBottom: '1rem' }}>
        <div className="eyebrow" style={{ color: '#166534', fontWeight: 700 }}>
          HỆ THỐNG QUẢN TRỊ TÂM AN CARE
        </div>

        <h1 className="page-title" style={{ fontSize: '1.4rem' }}>
          Đăng Nhập & Chọn Vai Trò Nhân Sự
        </h1>

        <p className="page-description">
          Vui lòng chọn hoặc nhập tài khoản làm việc của bạn để truy cập chức năng hệ thống ({location.pathname}).
        </p>
      </header>

      <DevelopmentActorPanel />
    </section>
  );
}
