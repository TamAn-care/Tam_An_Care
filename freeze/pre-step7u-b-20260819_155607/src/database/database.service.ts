import {
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';

import {
  Pool,
  PoolClient,
  QueryResult,
  QueryResultRow,
} from 'pg';


@Injectable()
export class DatabaseService
  implements OnModuleDestroy
{
  private readonly logger =
    new Logger(DatabaseService.name);

  private readonly pool: Pool;

  constructor() {

    const connectionString =
      process.env.DATABASE_URL;

    this.pool = connectionString
      ? new Pool({
          connectionString,
          max: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        })
      : new Pool({
          host:
            process.env.DB_HOST ||
            'postgres',

          port:
            Number(
              process.env.DB_PORT ||
              5432
            ),

          user:
            process.env.POSTGRES_USER ||
            process.env.DB_USER ||
            'taman',

          password:
            process.env.POSTGRES_PASSWORD ||
            process.env.DB_PASSWORD ||
            'taman_dev_password',

          database:
            process.env.POSTGRES_DB ||
            process.env.DB_NAME ||
            'taman_care',

          max: 10,

          idleTimeoutMillis: 30000,

          connectionTimeoutMillis: 5000,
        });

    this.pool.on(
      'error',
      (error: Error) => {

        this.logger.error(
          'Unexpected PostgreSQL pool error',
          error.stack,
        );

      },
    );
  }


  async query<
    T extends QueryResultRow = any
  >(
    text: string,
    params: any[] = [],
  ): Promise<QueryResult<T>> {

    return this.pool.query<T>(
      text,
      params,
    );

  }


  async withTransaction<T>(
    operation:
      (client: PoolClient) => Promise<T>,
  ): Promise<T> {

    const client =
      await this.pool.connect();

    try {

      await client.query('BEGIN');

      const result =
        await operation(client);

      await client.query('COMMIT');

      return result;

    } catch (error) {

      await client.query('ROLLBACK');

      throw error;

    } finally {

      client.release();

    }

  }


  async healthCheck(): Promise<boolean> {

    const result =
      await this.query<{ ok: number }>(
        'SELECT 1 AS ok',
      );

    return result.rows[0]?.ok === 1;

  }


  async onModuleDestroy(): Promise<void> {

    await this.pool.end();

  }
}
