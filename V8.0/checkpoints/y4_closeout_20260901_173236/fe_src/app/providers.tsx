import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';

import type {
  PropsWithChildren,
} from 'react';

import {
  ActorProvider,
} from '../auth/ActorContext';

const queryClient =
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15000,
        retry: 1,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });

export function AppProviders({
  children,
}: PropsWithChildren) {
  return (
    <QueryClientProvider
      client={queryClient}
    >
      <ActorProvider>
        {children}
      </ActorProvider>
    </QueryClientProvider>
  );
}
