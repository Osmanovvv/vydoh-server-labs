import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config/env.js';

describe('environment configuration', () => {
  it('uses safe defaults when optional variables are absent', () => {
    assert.deepEqual(loadConfig({}), {
      appName: 'VYDOH Lab 3 API',
      version: '1.0.0',
      environment: 'development',
      httpPort: 8080,
    });
  });

  it('parses explicit values', () => {
    assert.deepEqual(
      loadConfig({
        APP_NAME: 'Demo API',
        APP_VERSION: '2.0.0',
        APP_ENV: 'test',
        HTTP_PORT: '9090',
      }),
      {
        appName: 'Demo API',
        version: '2.0.0',
        environment: 'test',
        httpPort: 9090,
      },
    );
  });

  it('rejects unsupported environment and invalid port', () => {
    assert.throws(() => loadConfig({ APP_ENV: 'staging' }), /APP_ENV/);
    assert.throws(() => loadConfig({ HTTP_PORT: '70000' }), /HTTP_PORT/);
  });
});
