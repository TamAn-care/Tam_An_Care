import type {
  HumanActorSession,
} from '../types/actor';

import {
  ApiError,
  vietnameseApiMessage,
} from './errors';

const DEFAULT_API_BASE =
  'http://127.0.0.1:3000';

export const API_BASE_URL =
  (
    (import.meta as any)?.env
      ?.VITE_API_BASE_URL as string |
      undefined
  )?.replace(/\/$/, '') ||
  DEFAULT_API_BASE;

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

  const controller =
    new AbortController();

  const timeout =
    window.setTimeout(
      () => controller.abort(),
      timeoutMs,
    );

  try {
    const requestHeaders =
      new Headers(headers);

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
          headers: requestHeaders,
          signal: controller.signal,
        },
      );

    if (!response.ok) {
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
      error instanceof ApiError
    ) {
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
