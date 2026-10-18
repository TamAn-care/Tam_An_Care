import { readFileSync } from 'fs';
import { PoolConfig } from 'pg';

export function databaseConnectionString(): string | undefined {
  const secretFile = process.env.DATABASE_URL_FILE?.trim();

  if (secretFile) {
    let value: string;
    try {
      value = readFileSync(secretFile, 'utf8').trim();
    } catch {
      throw new Error('DATABASE_URL_FILE could not be read');
    }

    if (!value) {
      throw new Error('DATABASE_URL_FILE is empty');
    }

    return value;
  }

  return process.env.DATABASE_URL?.trim() || undefined;
}

export function databasePoolConfig(): PoolConfig {
  const connectionString = databaseConnectionString();
  const production = process.env.NODE_ENV === 'production';

  if (production && !connectionString) {
    throw new Error(
      'DATABASE_URL_FILE or DATABASE_URL is required in production',
    );
  }

  if (connectionString) {
    return { connectionString };
  }

  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.POSTGRES_USER || process.env.DB_USER || 'taman',
    password:
      process.env.POSTGRES_PASSWORD ||
      process.env.DB_PASSWORD ||
      'taman_dev_password',
    database:
      process.env.POSTGRES_DB || process.env.DB_NAME || 'taman_care',
  };
}
