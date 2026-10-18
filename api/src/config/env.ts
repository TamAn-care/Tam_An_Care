import * as fs from 'fs';

export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  isProduction: boolean;
  port: number;
  database: {
    connectionString?: string;
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    maxConnections: number;
  };
  jwt: {
    secret: string;
  };
  cors: {
    allowedOrigins: string[];
  };
  rateLimit: {
    perMinute: number;
  };
  swagger: {
    enabled: boolean;
  };
}

/**
 * Resolves a configuration value from:
 * 1. An explicit file pointer environment variable (e.g. DATABASE_URL_FILE)
 * 2. An explicit default secret path (e.g. /run/secrets/database_url)
 * 3. A direct environment variable (e.g. DATABASE_URL)
 * 4. A provided fallback default
 */
export function readSecretOrEnv(
  envVar: string,
  fileEnvVar?: string,
  defaultSecretPath?: string,
  fallback?: string,
): string | undefined {
  // 1. Check file-based environment variable (e.g. DATABASE_URL_FILE)
  if (fileEnvVar && process.env[fileEnvVar]) {
    const filePath = process.env[fileEnvVar]!.trim();
    if (filePath) {
      try {
        if (fs.existsSync(filePath)) {
          return fs.readFileSync(filePath, 'utf8').trim();
        }
        throw new Error(`Secret file at ${filePath} defined by ${fileEnvVar} does not exist`);
      } catch (err: any) {
        throw new Error(`Failed to read secret file (${fileEnvVar}=${filePath}): ${err.message}`);
      }
    }
  }

  // 2. Check direct environment variable
  const directVal = process.env[envVar];
  if (directVal !== undefined && directVal.trim() !== '') {
    return directVal.trim();
  }

  // 3. Check default Docker secret path if provided
  if (defaultSecretPath && fs.existsSync(defaultSecretPath)) {
    try {
      return fs.readFileSync(defaultSecretPath, 'utf8').trim();
    } catch {
      // Ignore if not accessible
    }
  }

  return fallback;
}

export function resolveCorsOrigins(isProduction: boolean): string[] {
  const rawOrigins =
    process.env.CORS_ALLOWED_ORIGINS ||
    process.env.CORS_ORIGIN ||
    '';

  const parsed = rawOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (parsed.length > 0) {
    return parsed;
  }

  if (isProduction) {
    throw new Error('CORS_ALLOWED_ORIGINS or CORS_ORIGIN is required in production');
  }

  return [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];
}

export function loadAppConfig(): AppConfig {
  const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase() as 'development' | 'production' | 'test';
  const isProduction = nodeEnv === 'production';

  // 1. Resolve Database Credentials
  const databaseUrl = readSecretOrEnv('DATABASE_URL', 'DATABASE_URL_FILE', '/run/secrets/database_url');
  const dbUser = process.env.POSTGRES_USER || process.env.DB_USER || 'taman';
  const dbPassword = readSecretOrEnv(
    'POSTGRES_PASSWORD',
    'POSTGRES_PASSWORD_FILE',
    '/run/secrets/postgres_password',
    process.env.DB_PASSWORD || (isProduction ? undefined : 'taman_dev_password'),
  );
  const dbHost = process.env.DB_HOST || (isProduction ? 'postgres' : '127.0.0.1');
  const dbPort = Number(process.env.DB_PORT || 5432);
  const dbName = process.env.POSTGRES_DB || process.env.DB_NAME || 'taman_care';

  if (isProduction && !databaseUrl && !dbPassword) {
    throw new Error('DATABASE_URL (or DATABASE_URL_FILE) or POSTGRES_PASSWORD is required in production');
  }

  // 2. Resolve JWT Secret
  const jwtSecret = readSecretOrEnv(
    'JWT_SECRET',
    'JWT_SECRET_FILE',
    '/run/secrets/jwt_secret',
    isProduction ? undefined : 'change-this-development-secret-with-more-than-32-chars-long',
  );

  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error(
      `JWT_SECRET (or JWT_SECRET_FILE) must be at least 32 characters long. Provided length: ${jwtSecret ? jwtSecret.length : 0}`,
    );
  }

  // 3. Resolve CORS & Rate Limiting
  const allowedOrigins = resolveCorsOrigins(isProduction);
  const rateLimitPerMinute = Number(process.env.RATE_LIMIT_PER_MINUTE) || 600;
  const swaggerEnabled = !isProduction || process.env.ENABLE_SWAGGER === 'true';
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;

  return {
    nodeEnv,
    isProduction,
    port,
    database: {
      connectionString: databaseUrl,
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      maxConnections: 10,
    },
    jwt: {
      secret: jwtSecret,
    },
    cors: {
      allowedOrigins,
    },
    rateLimit: {
      perMinute: rateLimitPerMinute,
    },
    swagger: {
      enabled: swaggerEnabled,
    },
  };
}
