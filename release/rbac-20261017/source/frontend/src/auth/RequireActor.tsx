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
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem 0.5rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: '960px' }}>
        <DevelopmentActorPanel />
      </div>
    </div>
  );
}
