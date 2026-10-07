# vydoh-server-labs

Лабораторные работы по дисциплине **«Разработка серверных приложений»**.

| | |
|---|---|
| Студент | Османов Сервер Ильясович, группа И-1-23 |
| Вариант | собственная тема — сквозной проект ВКР |
| Сквозной проект | **«Разработка Telegram-бота для планирования задач на основе транскрибации сообщений с использованием ИИ»** — бот «ВЫДОХ» |
| Исходный код приложения | коммерческий проект, код в закрытом доступе; фрагменты показываются по запросу |

## О проекте

**«ВЫДОХ»** — Telegram-бот, который принимает поток мыслей голосом или текстом, расшифровывает речь, с помощью языковой модели раскладывает сказанное на задачи, желания, идеи, информацию и эмоции, ведёт бэклог дел по сферам жизни и доводит до одного конкретного следующего действия. Утренние и вечерние сводки и напоминания о сроках бот присылает сам.

Стек: Node.js 24 + TypeScript, grammY, Express 5, PostgreSQL 17 + pgvector, Redis + BullMQ, Yandex SpeechKit и YandexGPT, React-админка, Docker Compose + Caddy.

Исходный код бота относится к закрытому коммерческому проекту и в учебный репозиторий не включён. Лабораторная №1 содержит открытые результаты проектирования: архитектурный отчёт, модель предметной области, C4- и ER-диаграммы, исходники диаграмм и словарь данных.

## Лабораторные работы

| № | Тема | Результат |
|---|---|---|
| 1 | Проектирование архитектуры серверного приложения и предметной области | [ARCHITECTURE.md](ARCHITECTURE.md) — роли и Use Cases, модель предметной области, C4 (Context, Container, Component), ER-диаграммы (логическая модель в 3НФ и физическая схема), [словарь данных](docs/data-dictionary.md), [ответы на контрольные вопросы](docs/lab-01-control-answers.md) |
| 2 | Проектирование REST API и спецификация OpenAPI 3.0 | [REST API Specs](ARCHITECTURE.md#8-rest-api-specs-лабораторная-работа-2) в `ARCHITECTURE.md`, [openapi.yaml](openapi.yaml), [ответы на контрольные вопросы](docs/lab-02-control-answers.md) |
| 3 | Базовый каркас, Clean / Layered Architecture и конфигурация окружения | `src/` — слои приложения, [`.env.example`](.env.example), [`.gitignore`](.gitignore), `GET /api/v1/health`, [ответы на контрольные вопросы](docs/lab-03-control-answers.md) |
| 4 | Контейнеризация приложения с Docker | [`Dockerfile`](Dockerfile), [`.dockerignore`](.dockerignore), multi-stage build, запуск контейнера и проверка health-check, [ответы на контрольные вопросы](docs/lab-04-control-answers.md) |

## Структура репозитория

```
README.md                 описание репозитория
ARCHITECTURE.md           лабораторная №1: архитектурный отчёт
openapi.yaml              лабораторная №2: REST API и OpenAPI 3.0
package.json              лабораторная №3: команды и зависимости Node.js
package-lock.json         зафиксированные версии зависимостей
tsconfig.json             строгая конфигурация TypeScript
.env.example              шаблон переменных окружения
.gitignore                исключения Git для проекта
Dockerfile                multi-stage сборка production-образа
.dockerignore             исключения из Docker build context
src/
  config/                 загрузка и проверка конфигурации
  controllers/            HTTP-контроллеры
  middleware/             обработка ошибок Express
  repositories/           граница доступа к данным
  services/               бизнес-логика
  app.ts                  сборка Express-приложения
  server.ts               точка запуска HTTP-сервера
test/                     автоматическая проверка health-check
docs/
  data-dictionary.md      описание всех таблиц, полей, ограничений и индексов
  lab-01-control-answers.md ответы на контрольные вопросы лабораторной №1
  lab-02-control-answers.md ответы на контрольные вопросы лабораторной №2
  lab-03-control-answers.md ответы на контрольные вопросы лабораторной №3
  lab-04-control-answers.md ответы на контрольные вопросы лабораторной №4
  diagrams/
    *.puml                исходники диаграмм (PlantUML)
    *.png, *.svg          экспорты диаграмм
```

## Как пересобрать диаграммы

Нужна Java 11+ и [PlantUML](https://plantuml.com/download) (библиотека C4 встроена):

```bash
java -jar plantuml.jar -charset UTF-8 -tpng docs/diagrams/*.puml
java -jar plantuml.jar -charset UTF-8 -tsvg docs/diagrams/*.puml
```

## Запуск учебного сервера лабораторной №3

Нужен Node.js 20 или новее. Установите зависимости и запустите проверку:

```bash
npm install
npm test
```

Для запуска сервера скопируйте `.env.example` в `.env`, при необходимости измените
порт и выполните:

```bash
npm run build
npm start
```

Проверка health-check:

```bash
curl http://localhost:8080/api/v1/health
```

Ожидается `200 OK` и JSON с полями `status`, `app_name`, `version`, `environment`
и `uptime`. Файл `.env` не коммитится; в репозитории хранится только `.env.example`.

## Сборка и запуск в Docker (лабораторная №4)

Нужен запущенный Docker Desktop или другой Docker Engine. В корне репозитория
соберите multi-stage образ:

```bash
docker build -t vydoh-lab3-server:latest .
```

Запустите контейнер с пробросом порта и конфигурацией через переменные окружения:

```bash
docker run --name vydoh-lab3-container -d \
  -p 8080:8080 \
  -e APP_NAME="VYDOH Lab 3 API" \
  -e APP_VERSION=1.0.0 \
  -e APP_ENV=production \
  -e HTTP_PORT=8080 \
  vydoh-lab3-server:latest
```

Проверьте endpoint внутри запущенного контейнера с хоста:

```bash
curl http://localhost:8080/api/v1/health
docker ps
docker logs vydoh-lab3-container
```

В `docker ps` контейнер должен иметь статус `healthy`, а endpoint — вернуть `200 OK`
и JSON с `status`, `app_name`, `version`, `environment` и `uptime`. После проверки
контейнер можно остановить и удалить:

```bash
docker stop vydoh-lab3-container
docker rm vydoh-lab3-container
```

`.dockerignore` исключает `.env`, зависимости, исходные тесты, документацию и
локальные артефакты из build context. Финальный образ содержит только production-
зависимости и скомпилированный каталог `dist`.
