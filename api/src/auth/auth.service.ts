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

interface GuardianCredentialRow {
  guardian_id: string;
  login_id: string;
  display_name: string;
  status: string;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
  password_digest: string;
  failed_attempts: number;
  locked_until: Date | string | null;
}

export interface ResolvedActor {
  actorId: string;
  staffCode: string;
  displayName: string;
  actorRole: string;
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
      `SELECT actor_id AS "actorId",
              staff_code AS "staffCode",
              display_name AS "displayName",
              primary_operational_role AS "actorRole",
              status
       FROM staff_actors
       WHERE status = 'ACTIVE'
       ORDER BY
         CASE primary_operational_role
           WHEN 'SUPERVISOR' THEN 1
           WHEN 'CARE_MANAGER' THEN 2
           WHEN 'NURSE' THEN 3
           WHEN 'CAREGIVER' THEN 4
           ELSE 5
         END,
         display_name ASC`,
    );

    return result.rows;
  }

  async resolveActor(
    actorId: string,
  ): Promise<ResolvedActor> {
    const trimmed =
      String(actorId || '').trim();

    if (!trimmed) {
      throw new UnauthorizedException(
        'Mã nhân viên không được để trống',
      );
    }

    const normalized =
      trimmed.replace(
        /^(ta-|nv-|staff-)/i,
        '',
      );

    const result = await this.db.query(
      `SELECT actor_id AS "actorId",
              staff_code AS "staffCode",
              display_name AS "displayName",
              primary_operational_role AS "actorRole",
              status
       FROM staff_actors
       WHERE UPPER(actor_id) = UPPER($1)
          OR UPPER(staff_code) = UPPER($1)
          OR UPPER(actor_id) = UPPER('TA-' || $2)
          OR UPPER(staff_code) = UPPER('TA-' || $2)
          OR UPPER(actor_id) = UPPER('STAFF-' || $2)
          OR UPPER(staff_code) = UPPER('NV-' || $2)
          OR UPPER(staff_code) = UPPER($2)
       LIMIT 1`,
      [
        trimmed,
        normalized,
      ],
    );

    if (!result.rows.length) {
      throw new UnauthorizedException(
        'Không tìm thấy nhân sự với mã: ' +
          trimmed,
      );
    }

    const row =
      result.rows[0] as ResolvedActor;

    if (row.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'Tài khoản nhân sự hiện đang tạm khóa hoặc không hoạt động',
      );
    }

    return row;
  }

  async login(
    actorIdOrCode: string,
    password: string,
  ) {
    if (
      !actorIdOrCode ||
      !password
    ) {
      throw new UnauthorizedException(
        'Invalid credentials',
      );
    }

    let actor:
      ResolvedActor;

    try {
      actor =
        await this.resolveActor(
          actorIdOrCode,
        );
    } catch {
      throw new UnauthorizedException(
        'Invalid credentials',
      );
    }

    const canonicalActorId =
      actor.actorId;

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
        [
          canonicalActorId,
        ],
      );

    const row =
      result.rows[0];

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
        [
          canonicalActorId,
        ],
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
      [
        canonicalActorId,
      ],
    );

    const now =
      Math.floor(
        Date.now() / 1000,
      );

    const expiresAt =
      now + 28800;

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
        canonicalActorId,
        row.primary_operational_role,
        now,
        expiresAt,
      ],
    );

    return {
      accessToken:
        this.issueToken(
          canonicalActorId,
          row.primary_operational_role,
          sessionId,
          now,
          expiresAt,
        ),
      tokenType: 'Bearer',
      expiresIn: 28800,
      actor: {
        actorId:
          actor.actorId,
        staffCode:
          actor.staffCode,
        displayName:
          actor.displayName,
        actorRole:
          actor.actorRole,
        status:
          actor.status,
      },
    };
  }

  async loginGuardian(loginIdInput: string, password: string) {
    const loginId = String(loginIdInput || '').trim().toLowerCase();
    if (!loginId || loginId.length > 254 || !password || password.length > 256) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const result = await this.db.query<GuardianCredentialRow>(
      `SELECT g.guardian_id, g.login_id, g.display_name, g.status,
              c.password_hash, c.password_salt, c.password_iterations,
              c.password_digest, c.failed_attempts, c.locked_until
         FROM guardian_identities g
         JOIN guardian_credentials c ON c.guardian_id=g.guardian_id
        WHERE g.login_id=$1
        LIMIT 1`,
      [loginId],
    );
    const row = result.rows[0];
    if (!row || row.status !== 'ACTIVE' || (row.locked_until && new Date(row.locked_until).getTime() > Date.now())) {
      if (row) await this.recordGuardianLoginFailure(row.guardian_id);
      throw new UnauthorizedException('Invalid credentials');
    }

    let valid = false;
    try {
      if (row.password_digest === 'sha256' && row.password_iterations >= 100000 && row.password_iterations <= 1000000
        && /^[0-9a-f]{64}$/.test(row.password_hash) && /^[0-9a-f]{48,128}$/.test(row.password_salt)) {
        const calculated = pbkdf2Sync(password, row.password_salt, row.password_iterations, 32, 'sha256');
        const expected = Buffer.from(row.password_hash, 'hex');
        valid = expected.length === calculated.length && timingSafeEqual(expected, calculated);
      }
    } catch {
      valid = false;
    }
    if (!valid) {
      await this.recordGuardianLoginFailure(row.guardian_id);
      throw new UnauthorizedException('Invalid credentials');
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + 28800;
    const sessionId = randomUUID();
    await this.db.withTransaction(async client => {
      const active = await client.query<GuardianCredentialRow>(
        `SELECT g.guardian_id, g.login_id, g.display_name, g.status,
                c.password_hash, c.password_salt, c.password_iterations,
                c.password_digest, c.failed_attempts, c.locked_until
           FROM guardian_identities g
          JOIN guardian_credentials c ON c.guardian_id=g.guardian_id
         WHERE g.guardian_id=$1 AND g.status='ACTIVE'
           AND (c.locked_until IS NULL OR c.locked_until<=now())
         FOR UPDATE OF g,c`,
        [row.guardian_id],
      );
      const lockedRow = active.rows[0];
      if (!lockedRow || lockedRow.password_hash !== row.password_hash
        || lockedRow.password_salt !== row.password_salt
        || lockedRow.password_iterations !== row.password_iterations
        || lockedRow.password_digest !== row.password_digest) {
        throw new UnauthorizedException('Invalid credentials');
      }
      await client.query(
        `UPDATE guardian_credentials SET failed_attempts=0, locked_until=NULL, updated_at=now()
          WHERE guardian_id=$1`, [row.guardian_id],
      );
      await client.query(
        `INSERT INTO guardian_sessions(session_id,guardian_id,issued_at,expires_at)
         VALUES($1,$2,to_timestamp($3),to_timestamp($4))`,
        [sessionId,row.guardian_id,now,expiresAt],
      );
      await client.query(
        `INSERT INTO guardian_auth_audit(guardian_id,event_type,session_id)
         VALUES($1,'LOGIN_SUCCEEDED',$2)`, [row.guardian_id,sessionId],
      );
    });

    return {
      accessToken: this.issueToken(row.guardian_id, 'GUARDIAN', sessionId, now, expiresAt),
      tokenType: 'Bearer',
      expiresIn: 28800,
      actor: { actorId: row.guardian_id, displayName: row.display_name, actorRole: 'GUARDIAN' as const },
    };
  }

  private async recordGuardianLoginFailure(guardianId: string): Promise<void> {
    await this.db.query(
      `UPDATE guardian_credentials
          SET failed_attempts=failed_attempts+1,
              locked_until=CASE WHEN failed_attempts+1>=5 THEN now()+interval '15 minutes' ELSE locked_until END,
              updated_at=now()
        WHERE guardian_id=$1`, [guardianId],
    );
    await this.db.query(
      `INSERT INTO guardian_auth_audit(guardian_id,event_type) VALUES($1,'LOGIN_FAILED')`, [guardianId],
    );
  }

  async revokeSession(
    actorId: string,
    sessionId: string,
  ): Promise<void> {
    if (
      !actorId ||
      !sessionId
    ) {
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

    if (result.rowCount === 1) return;
    const guardianResult = await this.db.query(
      `UPDATE guardian_sessions SET revoked_at=now(), revoked_reason='LOGOUT'
        WHERE session_id=$1 AND guardian_id=$2 AND revoked_at IS NULL`,
      [sessionId, actorId],
    );
    if (guardianResult.rowCount !== 1) throw new UnauthorizedException('Authentication session is not active');
    await this.db.query(
      `INSERT INTO guardian_auth_audit(guardian_id,event_type,session_id)
       VALUES($1,'SESSION_REVOKED',$2)`, [actorId,sessionId],
    );
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

    if (
      !secret ||
      secret.length < 32
    ) {
      throw new Error(
        'JWT_SECRET must contain at least 32 characters',
      );
    }

    const encode =
      (value: unknown) =>
        Buffer
          .from(
            JSON.stringify(
              value,
            ),
          )
          .toString(
            'base64url',
          );

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
        .update(
          unsigned,
        )
        .digest(
          'base64url',
        );

    return `${unsigned}.${signature}`;
  }
}
