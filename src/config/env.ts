export type AppEnvironment = 'development' | 'test' | 'production';

export interface AppConfig {
  appName: string;
  version: string;
  environment: AppEnvironment;
  httpPort: number;
}

const DEFAULT_APP_NAME = 'VYDOH Lab 3 API';
const DEFAULT_VERSION = '1.0.0';
const DEFAULT_ENVIRONMENT: AppEnvironment = 'development';
const DEFAULT_HTTP_PORT = 8080;

function parseEnvironment(value: string | undefined): AppEnvironment {
  const environment = value ?? DEFAULT_ENVIRONMENT;

  if (environment === 'development' || environment === 'test' || environment === 'production') {
    return environment;
  }

  throw new Error('APP_ENV должен быть development, test или production');
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value.trim() === '') {
    return DEFAULT_HTTP_PORT;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error('HTTP_PORT должен быть целым числом');
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('HTTP_PORT должен быть в диапазоне от 1 до 65535');
  }

  return port;
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const appName = environment.APP_NAME?.trim() || DEFAULT_APP_NAME;
  const version = environment.APP_VERSION?.trim() || DEFAULT_VERSION;

  return {
    appName,
    version,
    environment: parseEnvironment(environment.APP_ENV),
    httpPort: parsePort(environment.HTTP_PORT),
  };
}
