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

const DEFAULT_API_BASE =
  '';

const configuredApiBase =
  (
    import.meta.env
      .VITE_API_BASE_URL as
        string | undefined
  )?.replace(/\/$/, '') ||
  DEFAULT_API_BASE;

/**
 * Production Test is served from the same origin as the API proxy.
 *
 * API paths throughout the application already include "/api/...".
 * Therefore "/api" must not also be used as API_BASE_URL, otherwise
 * requests become "/api/api/...".
 */
// PRODUCTION_SAME_ORIGIN_API_GUARD
// Production is served from the same origin behind Nginx.
// Application API paths already begin with /api.
// Therefore production API_BASE_URL MUST be empty.
export const API_BASE_URL =
  import.meta.env.PROD
    ? ''
    : configuredApiBase === '/api'
      ? ''
      : configuredApiBase;

export interface RequestOptions
  extends RequestInit {
  actor?:
    HumanActorSession | null;
  timeoutMs?: number;
}

export async function apiRequest<T>(
  path: string,
  options:
    RequestOptions = {},
): Promise<T> {
  const {
    actor,
    timeoutMs = 10000,
    headers,
    ...init
  } = options;

  const controller =
    new AbortController();

  const timeout =
    window.setTimeout(
      () =>
        controller.abort(),
      timeoutMs,
    );

  try {
    const requestHeaders =
      new Headers(
        headers,
      );

    requestHeaders.set(
      'Accept',
      'application/json',
    );

    if (
      init.body &&
      !requestHeaders.has(
        'Content-Type',
      )
    ) {
      requestHeaders.set(
        'Content-Type',
        'application/json',
      );
    }

    const token =
      readStoredAccessToken();

    if (
      token &&
      !requestHeaders.has(
        'Authorization',
      )
    ) {
      requestHeaders.set(
        'Authorization',
        `Bearer ${token}`,
      );
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

    const response =
      await fetch(
        `${API_BASE_URL}${path}`,
        {
          ...init,
          headers:
            requestHeaders,
          signal:
            controller.signal,
        },
      );

    if (!response.ok) {
      if (
        response.status ===
          401
      ) {
        clearStoredAuthSession();
      }

      throw new ApiError(
        response.status,
        vietnameseApiMessage(
          response.status,
        ),
      );
    }

    const contentType =
      response.headers.get(
        'content-type',
      );

    if (
      contentType?.includes(
        'application/json',
      )
    ) {
      return await response.json() as T;
    }

    return undefined as T;
  } catch (error) {
    if (
      error instanceof
        ApiError
    ) {
      throw error;
    }

    if (
      error instanceof
        DOMException &&
      error.name ===
        'AbortError'
    ) {
      throw new Error(
        'Yêu cầu tới hệ thống đã quá thời gian chờ.',
      );
    }

    throw new Error(
      'Không thể kết nối tới hệ thống. Vui lòng kiểm tra kết nối.',
    );
  } finally {
    window.clearTimeout(
      timeout,
    );
  }
}
