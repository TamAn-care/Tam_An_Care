import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import {
  createHmac,
  pbkdf2Sync,
  randomUUID,
  timingSafeEqual,
} from 'crypto';

import {
  DatabaseService,
} from '../database/database.service';

interface CredentialRow {
  actor_id: string;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
  password_digest: string;
  locked_until: Date | string | null;
  primary_operational_role: string;
  status: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db:
      DatabaseService,
  ) {}

  async listActiveStaff() {
    const result = await this.db.query(
      `SELECT actor_id AS "actorId", staff_code AS "staffCode", display_name AS "displayName",
              primary_operational_role AS "actorRole", status
       FROM staff_actors
       WHERE status = 'ACTIVE'
       ORDER BY 
         CASE primary_operational_role
           WHEN 'SUPERVISOR' THEN 1
           WHEN 'CARE_MANAGER' THEN 2
           WHEN 'NURSE' THEN 3
           WHEN 'CAREGIVER' THEN 4
           ELSE 5
         END, display_name ASC`,
    );
    return result.rows;
  }

  async resolveActor(actorId: string) {
    const trimmed = String(actorId || '').trim();
    if (!trimmed) {
      throw new UnauthorizedException('Mã nhân viên không được để trống');
    }
    const result = await this.db.query(
      `SELECT actor_id AS "actorId", staff_code AS "staffCode", display_name AS "displayName",
              primary_operational_role AS "actorRole", status
       FROM staff_actors
       WHERE (actor_id = $1 OR staff_code = $1)
       LIMIT 1`,
      [trimmed],
    );
    if (!result.rows.length) {
      throw new UnauthorizedException('Không tìm thấy nhân sự với mã: ' + trimmed);
    }
    const row = result.rows[0];
    if (row.status !== 'ACTIVE') {
      throw new UnauthorizedException('Tài khoản nhân sự hiện đang tạm khóa hoặc không hoạt động');
    }
    return row;
  }

  async login(
    actorId: string,
    password: string,
  ) {
    if (!actorId || !password) {
      throw new UnauthorizedException(
        'Invalid credentials',
      );
    }

    const result =
      await this.db.query<CredentialRow>(
        `
        SELECT
          c.actor_id,
          c.password_hash,
          c.password_salt,
          c.password_iterations,
          c.password_digest,
          c.locked_until,
          s.primary_operational_role,
          s.status
        FROM auth_credentials c
        JOIN staff_actors s
          ON s.actor_id = c.actor_id
        WHERE c.actor_id = $1
        LIMIT 1
        `,
        [actorId],
      );

    const row = result.rows[0];

    if (
      !row ||
      row.status !== 'ACTIVE' ||
      (
        row.locked_until &&
        new Date(
          row.locked_until,
        ).getTime() > Date.now()
      )
    ) {
      throw new UnauthorizedException(
        'Invalid credentials',
      );
    }

    const calculated =
      pbkdf2Sync(
        password,
        row.password_salt,
        row.password_iterations,
        32,
        row.password_digest,
      );

    const expected =
      Buffer.from(
        row.password_hash,
        'hex',
      );

    const valid =
      expected.length ===
        calculated.length &&
      timingSafeEqual(
        expected,
        calculated,
      );

    if (!valid) {
      await this.db.query(
        `
        UPDATE auth_credentials
        SET
          failed_attempts =
            failed_attempts + 1,
          locked_until =
            CASE
              WHEN failed_attempts + 1 >= 5
              THEN now() + interval '15 minutes'
              ELSE locked_until
            END,
          updated_at = now()
        WHERE actor_id = $1
        `,
        [actorId],
      );

      throw new UnauthorizedException(
        'Invalid credentials',
      );
    }

    await this.db.query(
      `
      UPDATE auth_credentials
      SET
        failed_attempts = 0,
        locked_until = NULL,
        last_login_at = now(),
        updated_at = now()
      WHERE actor_id = $1
      `,
      [actorId],
    );

    const now =
      Math.floor(Date.now() / 1000);

    const expiresAt =
      now + 3600;

    const sessionId =
      randomUUID();

    await this.db.query(
      `
      INSERT INTO auth_sessions (
        session_id,
        actor_id,
        actor_role,
        issued_at,
        expires_at
      )
      VALUES (
        $1,
        $2,
        $3,
        to_timestamp($4),
        to_timestamp($5)
      )
      `,
      [
        sessionId,
        row.actor_id,
        row.primary_operational_role,
        now,
        expiresAt,
      ],
    );

    return {
      accessToken:
        this.issueToken(
          row.actor_id,
          row.primary_operational_role,
          sessionId,
          now,
          expiresAt,
        ),
      tokenType: 'Bearer',
      expiresIn: 3600,
    };
  }

  async revokeSession(
    actorId: string,
    sessionId: string,
  ): Promise<void> {
    if (!actorId || !sessionId) {
      throw new UnauthorizedException(
        'Invalid authentication session',
      );
    }

    const result =
      await this.db.query(
        `
        UPDATE auth_sessions
        SET
          revoked_at = now(),
          revoked_reason = 'LOGOUT'
        WHERE session_id = $1
          AND actor_id = $2
          AND revoked_at IS NULL
        `,
        [
          sessionId,
          actorId,
        ],
      );

    if (result.rowCount !== 1) {
      throw new UnauthorizedException(
        'Authentication session is not active',
      );
    }
  }

  private issueToken(
    actorId: string,
    role: string,
    sessionId: string,
    now: number,
    expiresAt: number,
  ): string {
    const secret =
      process.env.JWT_SECRET;

    if (!secret || secret.length < 32) {
      throw new Error(
        'JWT_SECRET must contain at least 32 characters',
      );
    }

    const encode =
      (value: unknown) =>
        Buffer
          .from(
            JSON.stringify(value),
          )
          .toString('base64url');

    const unsigned =
      `${encode({
        alg: 'HS256',
        typ: 'JWT',
      })}.${encode({
        sub: actorId,
        role,
        jti: sessionId,
        iat: now,
        exp: expiresAt,
      })}`;

    const signature =
      createHmac(
        'sha256',
        secret,
      )
        .update(unsigned)
        .digest('base64url');

    return `${unsigned}.${signature}`;
  }
}
