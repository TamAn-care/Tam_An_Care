import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  readStoredActor,
  storeActor,
} from './session';

import type {
  HumanActorSession,
} from '../types/actor';

interface ActorContextValue {
  actor: HumanActorSession | null;
  setActor:
    (actor: HumanActorSession) => void;
  clearActor: () => void;
  isDevelopmentBootstrap: true;
}

const ActorContext =
  createContext<ActorContextValue | null>(
    null,
  );

export function ActorProvider({
  children,
}: PropsWithChildren) {
  const [actor, setActorState] =
    useState<HumanActorSession | null>(
      () => readStoredActor(),
    );

  const value = useMemo(
    (): ActorContextValue => ({
      actor,
      setActor(nextActor) {
        storeActor(nextActor);
        setActorState(nextActor);
      },
      clearActor() {
        storeActor(null);
        setActorState(null);
      },
      isDevelopmentBootstrap: true,
    }),
    [actor],
  );

  return (
    <ActorContext.Provider value={value}>
      {children}
    </ActorContext.Provider>
  );
}

export function useActor(): ActorContextValue {
  const value =
    useContext(ActorContext);

  if (!value) {
    throw new Error(
      'useActor must be used within ActorProvider',
    );
  }

  return value;
}
