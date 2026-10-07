import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp } from '../src/app.js';
import type { AppConfig } from '../src/config/env.js';

const testConfig: AppConfig = {
  appName: 'VYDOH Lab 3 Test API',
  version: '1.0.0-test',
  environment: 'test',
  httpPort: 0,
};

let server: Server;
let baseUrl: string;

before(async () => {
  server = createApp({ config: testConfig }).listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe('health-check', () => {
  it('returns the required service information from /api/v1/health', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`);
    const body = (await response.json()) as Record<string, unknown>;

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /^application\/json/);
    assert.deepEqual(body.status, 'pass');
    assert.deepEqual(body.app_name, testConfig.appName);
    assert.deepEqual(body.version, testConfig.version);
    assert.deepEqual(body.environment, testConfig.environment);
    assert.equal(typeof body.uptime, 'number');
    assert.ok((body.uptime as number) >= 0);
  });

  it('keeps /health as a documented-compatible alias', async () => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
  });
});
