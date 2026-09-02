import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import {
  createHmac,
  pbkdf2Sync,
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

    return {
      accessToken:
        this.issueToken(
          row.actor_id,
          row.primary_operational_role,
        ),
      tokenType: 'Bearer',
      expiresIn: 3600,
    };
  }

  private issueToken(
    actorId: string,
    role: string,
  ): string {
    const secret =
      process.env.JWT_SECRET;

    if (!secret || secret.length < 32) {
      throw new Error(
        'JWT_SECRET must contain at least 32 characters',
      );
    }

    const now =
      Math.floor(
        Date.now() / 1000,
      );

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
        iat: now,
        exp: now + 3600,
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
