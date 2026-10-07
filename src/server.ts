import dotenv from 'dotenv';
import { createApp } from './app.js';
import { loadConfig } from './config/env.js';

dotenv.config();

const config = loadConfig();
const app = createApp({ config });
const server = app.listen(config.httpPort, () => {
  console.log(`${config.appName} запущен на порту ${config.httpPort}`);
});

function shutdown(signal: string): void {
  console.log(`Получен ${signal}, завершаю HTTP-сервер`);
  server.close((error) => {
    if (error) {
      console.error('Ошибка при завершении HTTP-сервера', error);
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
