import {
  Pool,
} from 'pg';

type Arguments = {
  actorId: string;
  staffCode: string;
  displayName: string;
  employmentReference: string | null;
};

function value(
  name: string,
): string | null {
  const prefix = `--${name}=`;

  const item =
    process.argv
      .slice(2)
      .find((entry) =>
        entry.startsWith(prefix),
      );

  if (!item) {
    return null;
  }

  return item.slice(prefix.length).trim();
}

function required(
  name: string,
): string {
  const result = value(name);

  if (!result) {
    throw new Error(
      `Missing required --${name}=...`,
    );
  }

  return result;
}

function parseArguments(): Arguments {
  const actorId = required('actor-id');
  const staffCode = required('staff-code');
  const displayName = required('display-name');

  if (actorId === 'v79-phase1d-supervisor') {
    throw new Error(
      'Reserved historical fixture actor ID is forbidden',
    );
  }

  if (staffCode === 'V79-P1D-SUP-001') {
    throw new Error(
      'Reserved historical fixture staff code is forbidden',
    );
  }

  return {
    actorId,
    staffCode,
    displayName,
    employmentReference:
      value('employment-reference'),
  };
}

async function main(): Promise<void> {
  const databaseUrl =
    String(
      process.env.DATABASE_URL || '',
    ).trim();

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL must be explicitly supplied',
    );
  }

  const args = parseArguments();

  const pool = new Pool({
    connectionString: databaseUrl,
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      'LOCK TABLE staff_actors IN EXCLUSIVE MODE',
    );

    const baseline =
      await client.query<{
        staff_count: string;
        active_supervisor_count: string;
      }>(
        `
        SELECT
          COUNT(*)::text AS staff_count,
          COUNT(*) FILTER (
            WHERE
              primary_operational_role = 'SUPERVISOR'
              AND status = 'ACTIVE'
          )::text AS active_supervisor_count
        FROM staff_actors
        `,
      );

    const row = baseline.rows[0];

    if (
      !row
      || Number(row.staff_count) !== 0
      || Number(
        row.active_supervisor_count,
      ) !== 0
    ) {
      throw new Error(
        'Bootstrap allowed only when staff actor count and active Supervisor count are both zero',
      );
    }

    const created =
      await client.query(
        `
        WITH inserted AS (
          INSERT INTO staff_actors (
            actor_id,
            staff_code,
            display_name,
            primary_operational_role,
            status,
            employment_reference
          )
          VALUES (
            $1,
            $2,
            $3,
            'SUPERVISOR',
            'ACTIVE',
            $4
          )
          RETURNING *
        ),
        audit_insert AS (
          INSERT INTO staff_actor_audit (
            event_type,
            target_actor_id,
            performed_by,
            performed_by_role,
            previous_value,
            new_value
          )
          SELECT
            'STAFF_BOOTSTRAPPED',
            actor_id,
            'SYSTEM_OPERATOR',
            'BOOTSTRAP_OPERATOR',
            NULL,
            to_jsonb(inserted)
          FROM inserted
          RETURNING audit_id
        )
        SELECT
          actor_id,
          staff_code,
          display_name,
          primary_operational_role,
          status,
          employment_reference,
          created_at,
          updated_at
        FROM inserted
        `,
        [
          args.actorId,
          args.staffCode,
          args.displayName,
          args.employmentReference,
        ],
      );

    if (created.rowCount !== 1) {
      throw new Error(
        'Bootstrap did not create exactly one Supervisor',
      );
    }

    await client.query('COMMIT');

    console.log(
      'STAFF_BOOTSTRAP_STATUS=PASSED',
    );

    console.log(
      'BOOTSTRAPPED_ACTOR_ID='
      + args.actorId,
    );

    console.log(
      'BOOTSTRAPPED_ROLE=SUPERVISOR',
    );

    console.log(
      'BOOTSTRAPPED_STATUS=ACTIVE',
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : String(error),
  );

  process.exit(1);
});
