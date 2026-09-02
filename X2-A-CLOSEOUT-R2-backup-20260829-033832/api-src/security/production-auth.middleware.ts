import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createHmac,
  timingSafeEqual,
} from 'crypto';

type ActorRole =
  | 'CAREGIVER'
  | 'NURSE'
  | 'CARE_MANAGER'
  | 'SUPERVISOR';

interface JwtPayload {
  sub?: unknown;
  role?: unknown;
  exp?: unknown;
  nbf?: unknown;
}

interface HttpRequest {
  originalUrl: string;
  headers: Record<
    string,
    string | string[] | undefined
  >;
  header(name: string): string | undefined;
}

type HttpResponse = unknown;
type Next = () => void;

const VALID_ROLES = new Set<ActorRole>([
  'CAREGIVER',
  'NURSE',
  'CARE_MANAGER',
  'SUPERVISOR',
]);

function decode(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

function parseJson<T>(value: Buffer): T {
  return JSON.parse(
    value.toString('utf8'),
  ) as T;
}

function verifyHs256(
  token: string,
  secret: string,
): JwtPayload {
  const parts = token.split('.');

  if (parts.length !== 3) {
    throw new UnauthorizedException(
      'Invalid authentication token',
    );
  }

  const [
    encodedHeader,
    encodedPayload,
    encodedSignature,
  ] = parts;

  let header: { alg?: unknown; typ?: unknown };
  let payload: JwtPayload;
  let supplied: Buffer;

  try {
    header = parseJson(decode(encodedHeader));
    payload = parseJson(decode(encodedPayload));
    supplied = decode(encodedSignature);
  } catch {
    throw new UnauthorizedException(
      'Invalid authentication token',
    );
  }

  if (header.alg !== 'HS256') {
    throw new UnauthorizedException(
      'Unsupported authentication algorithm',
    );
  }

  const expected =
    createHmac('sha256', secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest();

  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  ) {
    throw new UnauthorizedException(
      'Invalid authentication signature',
    );
  }

  const now = Math.floor(Date.now() / 1000);

  if (
    typeof payload.exp === 'number' &&
    payload.exp <= now
  ) {
    throw new UnauthorizedException(
      'Authentication token expired',
    );
  }

  if (
    typeof payload.nbf === 'number' &&
    payload.nbf > now
  ) {
    throw new UnauthorizedException(
      'Authentication token not active',
    );
  }

  if (
    typeof payload.sub !== 'string' ||
    payload.sub.trim().length === 0
  ) {
    throw new UnauthorizedException(
      'Authentication subject is required',
    );
  }

  if (
    typeof payload.role !== 'string' ||
    !VALID_ROLES.has(payload.role as ActorRole)
  ) {
    throw new UnauthorizedException(
      'Authentication role is invalid',
    );
  }

  return payload;
}

@Injectable()
export class ProductionAuthMiddleware
  implements NestMiddleware
{
  use(
    req: HttpRequest,
    _res: HttpResponse,
    next: Next,
  ): void {
    if (process.env.NODE_ENV !== 'production') {
      next();
      return;
    }

    const path = req.originalUrl.split('?')[0];

    if (
      path === '/api/health' ||
      path === '/api/health/live' ||
      path === '/api/health/ready'
    ) {
      next();
      return;
    }

    const secret = process.env.JWT_SECRET;

    if (!secret || secret.length < 32) {
      throw new UnauthorizedException(
        'Production authentication is not configured',
      );
    }

    const authorization =
      req.header('authorization');

    if (
      !authorization ||
      !authorization.startsWith('Bearer ')
    ) {
      throw new UnauthorizedException(
        'Bearer authentication is required',
      );
    }

    const token =
      authorization.slice('Bearer '.length).trim();

    const payload =
      verifyHs256(token, secret);

    req.headers['x-actor-id'] =
      payload.sub as string;

    req.headers['x-actor-role'] =
      payload.role as string;

    next();
  }
}
