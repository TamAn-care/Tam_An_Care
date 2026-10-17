import { apiRequest } from '../api/client';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useEffect,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  readStoredActor,
  storeActor,
  readStoredAccessToken,
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
  const queryClient = useQueryClient();
  const [actor, setActorState] =
    useState<HumanActorSession | null>(
      () => readStoredActor(),
    );

  useEffect(() => {
    const clear = () => { setActorState(null); queryClient.clear(); };
    window.addEventListener('tamancare-auth-cleared', clear);
    const timer = window.setInterval(() => {
      if (!readStoredAccessToken()) clear();
    }, 15000);
    return () => { window.removeEventListener('tamancare-auth-cleared', clear); window.clearInterval(timer); };
  }, [queryClient]);

  const value = useMemo(
    (): ActorContextValue => ({
      actor,
      setActor(nextActor) {
        if (!readStoredAccessToken()) throw new Error('Vui lòng đăng nhập lại.');
        queryClient.clear();
        storeActor(nextActor);
        setActorState(nextActor);
      },
      clearActor() {
        if (readStoredAccessToken()) void apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {});
        storeActor(null);
        setActorState(null);
      },
      isDevelopmentBootstrap: true,
    }),
    [actor, queryClient],
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
