import type {
  HumanActorSession,
} from '../types/actor';

import {
  ApiError,
  vietnameseApiMessage,
} from './errors';

import {
  clearStoredAuthSession,
  readStoredAccessToken,
} from '../auth/session';

declare global {
  interface Window {
    __TAMAN_CONFIG__?: {
      API_BASE_URL?: string;
      ENABLE_DEV_SWITCHER?: boolean;
    };
  }
}

/**
 * Resolve API_BASE_URL:
 * 1. Runtime dynamic config via window.__TAMAN_CONFIG__ (e.g. from /config.js)
 * 2. Build-time Vite env var VITE_API_BASE_URL
 * 3. Default to empty string '' for origin-relative routing (e.g. /api/...)
 *    - In Development: Vite dev server proxies /api/* -> http://127.0.0.1:3000
 *    - In Production: Nginx reverse proxy forwards /api/* -> http://api:3000
 *    - In Standalone/CDN: window.__TAMAN_CONFIG__.API_BASE_URL can provide absolute host
 */
function resolveApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.__TAMAN_CONFIG__?.API_BASE_URL !== undefined) {
    const runtimeVal = window.__TAMAN_CONFIG__.API_BASE_URL.trim();
    if (runtimeVal === '/api') return '';
    return runtimeVal.replace(/\/$/, '');
  }

  const envVal = ((import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined)?.trim();
  if (envVal) {
    if (envVal === '/api') return '';
    return envVal.replace(/\/$/, '');
  }

  return '';
}

export const API_BASE_URL = resolveApiBaseUrl();

export interface RequestOptions
  extends RequestInit {
  actor?: HumanActorSession | null;
  timeoutMs?: number;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    actor,
    timeoutMs = 10000,
    headers,
    ...init
  } = options;

  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    timeoutMs,
  );

  try {
    const requestHeaders = new Headers(headers);

    requestHeaders.set(
      'Accept',
      'application/json',
    );

    if (
      init.body &&
      !requestHeaders.has('Content-Type')
    ) {
      requestHeaders.set(
        'Content-Type',
        'application/json',
      );
    }

    const token = readStoredAccessToken();
    if (token && !requestHeaders.has('Authorization')) {
      requestHeaders.set('Authorization', `Bearer ${token}`);
    }

    if (actor) {
      requestHeaders.set(
        'x-actor-id',
        actor.actorId,
      );

      requestHeaders.set(
        'x-actor-role',
        actor.actorRole,
      );
    }

    const response = await fetch(
      `${API_BASE_URL}${path}`,
      {
        ...init,
        headers: requestHeaders,
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      if (response.status === 401) {
        clearStoredAuthSession();
      }

      throw new ApiError(
        response.status,
        vietnameseApiMessage(response.status),
      );
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return (await response.json()) as T;
    }

    return undefined as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (
      error instanceof DOMException &&
      error.name === 'AbortError'
    ) {
      throw new Error(
        'Yêu cầu tới hệ thống đã quá thời gian chờ.',
      );
    }

    throw new Error(
      'Không thể kết nối tới hệ thống. Vui lòng kiểm tra kết nối.',
    );
  } finally {
    window.clearTimeout(timeout);
  }
}
