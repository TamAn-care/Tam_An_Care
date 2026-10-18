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
import { databasePoolConfig } from './database-connection';


@Injectable()
export class DatabaseService
  implements OnModuleDestroy
{
  private readonly logger =
    new Logger(DatabaseService.name);

  private readonly pool: Pool;

  constructor() {

    this.pool = new Pool({
      ...databasePoolConfig(),
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


  getPool(): Pool {
    return this.pool;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
