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
    <section>
      <header className="page-header">
        <div className="eyebrow">
          Yêu cầu xác định người dùng
        </div>

        <h1 className="page-title">
          Chưa có ngữ cảnh nhân sự
        </h1>

        <p className="page-description">
          Vui lòng xác định nhân sự thử nghiệm
          trước khi mở chức năng này.
        </p>
      </header>

      <div className="notice notice-info">
        <strong>
          Trang yêu cầu:
        </strong>{' '}
        {location.pathname}
      </div>

      <DevelopmentActorPanel />
    </section>
  );
}
