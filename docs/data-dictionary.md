# Словарь данных «ВЫДОХ»

Полное описание всех 28 таблиц PostgreSQL 17 — фактическое состояние БД (схема `apps/bot/src/db/schema.ts` и SQL-миграции `apps/bot/drizzle/0000–0069` исходного проекта). Обозначения в столбце «Ограничения»: **PK** — первичный ключ, **FK → t.c** — внешний ключ (в скобках — действие ON DELETE), **NN** — NOT NULL, **UQ** — UNIQUE, **DEF** — значение по умолчанию. Строка «Физическая схема» у каждой таблицы: **3НФ**, **денормализация** (осознанная, с причиной) или **нарушение 1НФ** (массив или составное значение). Логическая модель ядра в 3НФ и отличия логической модели остальных групп — в ARCHITECTURE.md, разделы 5.2 и 5.5.

Диаграммы: [логическая модель ядра (3НФ)](diagrams/erd-logical.png) · [ядро](diagrams/erd-core.png) · [оплата](diagrams/erd-billing.png) · [служебные](diagrams/erd-service.png)

## Содержание

- **Планирование и обработка сообщений:** [users](#users), [user_settings](#user_settings), [messages_raw](#messages_raw), [batches](#batches), [items](#items), [topics](#topics), [item_revisions](#item_revisions), [pending_questions](#pending_questions), [recurrence_suggestions](#recurrence_suggestions), [project_steps](#project_steps), [reminders](#reminders)
- **Подписка и оплата:** [promo_codes](#promo_codes), [billing_invoices](#billing_invoices), [billing_subscriptions](#billing_subscriptions), [billing_events](#billing_events), [billing_price_changes](#billing_price_changes), [billing_consents](#billing_consents)
- **Администрирование и служебные данные:** [telegram_updates](#telegram_updates), [prompt_versions](#prompt_versions), [ai_calls](#ai_calls), [app_settings](#app_settings), [documents](#documents), [document_versions](#document_versions), [text_overrides](#text_overrides), [misunderstood](#misunderstood), [admin_access_log](#admin_access_log), [broadcasts](#broadcasts), [broadcast_deliveries](#broadcast_deliveries)
- [Перечисления (ENUM)](#перечисления-enum)
- [Внешние ключи и индексы на них](#внешние-ключи-и-индексы-на-них)

## users

Пользователь бота (человек в Telegram): Telegram-идентификатор, профиль, часовой пояс, согласие на обработку персональных данных, признак блокировки бота. Корень каскадного удаления данных человека.

| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `uuid` | PK, DEF `gen_random_uuid()` | суррогатный ключ пользователя |
| `tg_id` | `bigint` | NN, UQ | ID пользователя в Telegram (bigint, читается как число) |
| `username` | `text` |  | username Telegram, обновляется при каждом сообщении |
| `first_name` | `text` |  | имя из Telegram, обновляется при каждом сообщении |
| `language_code` | `text` |  | язык клиента Telegram |
| `timezone` | `text` | NN, DEF `'Europe/Moscow'` | часовой пояс пользователя (имя IANA, например Europe/Moscow) |
| `timezone_confirmed` | `boolean` | NN, DEF `false` | пояс подтверждён на онбординге |
| `has_topics_enabled` | `boolean` | NN, DEF `false` | включён ли в чате режим веток (тем форума Telegram) |
| `referral_source` | `text` |  | параметр реферальной ссылки, пишется только при первом запуске |
| `consent_at` | `timestamptz` |  | момент первого согласия: у ранних пользователей — первое сообщение после публикации политики, у остальных — нажатие «Согласна» |
| `consent_confirmed_at` | `timestamptz` |  | нажатие «Согласна» — единственное согласие на разбор |
| `consent_edition` | `text` |  | редакция политики/согласия, на которую нажато |
| `inactivity_warned_at` | `timestamptz` |  | отправлено предупреждение об удалении после 24 месяцев тишины |
| `is_blocked` | `boolean` | NN, DEF `false` | пользователь заблокировал бота |
| `blocked_at` | `timestamptz` |  | начало текущего периода блокировки бота |
| `created_at` | `timestamptz` | NN, DEF `now()` | момент регистрации |
| `last_active_at` | `timestamptz` | NN, DEF `now()` | последняя активность пользователя |

**Ограничения:** PRIMARY KEY (id); `users_tg_id_unique`: UNIQUE (tg_id).

**Индексы:** `users_active_last_seen_idx`: btree (last_active_at) WHERE is_blocked = false.

**Связи:** внешних ключей нет. На таблицу ссылаются: `user_settings.user_id`, `messages_raw.user_id`, `batches.user_id`, `items.user_id`, `topics.user_id`, `ai_calls.user_id`, `item_revisions.user_id`, `pending_questions.user_id`, `recurrence_suggestions.user_id`, `project_steps.user_id`, `reminders.user_id`, `misunderstood.user_id`, `admin_access_log.subject_user_id`, `broadcast_deliveries.user_id`, `billing_invoices.user_id`, `billing_subscriptions.user_id`, `billing_consents.user_id`.

**Физическая схема:** денормализация. is_blocked избыточен относительно blocked_at (заполнено ⇔ заблокирован); частичный индекс активных пользователей построен по is_blocked, хотя эквивалентно выражается через blocked_at IS NULL.

## user_settings

Настройки и диалоговое состояние пользователя (1:1 с users, создаются вместе с пользователем): время утренней и вечерней сводки, режим тишины, шаг онбординга, ожидание ответа словами.

| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `user_id` | `uuid` | PK, FK → users.id (CASCADE) | владелец настроек, PK и FK одновременно |
| `morning_time` | `time` | NN, DEF `'08:30'` | локальное время утреннего напоминания |
| `evening_time` | `time` | NN, DEF `'21:00'` | локальное время вечернего напоминания |
| `notifications_on` | `boolean` | NN, DEF `true` | общий выключатель напоминаний |
| `evening_on` | `boolean` | NN, DEF `true` | отдельный выключатель вечернего напоминания |
| `quiet_hours_on` | `boolean` | NN, DEF `true` | режим тишины включён |
| `quiet_from` | `time` | NN, DEF `'22:00'` | начало тихих часов (может переходить полночь) |
| `quiet_to` | `time` | NN, DEF `'08:00'` | конец тихих часов |
| `text_profile` | `text` | NN, DEF `'reserved'` | профиль текстов бота, пока единственный reserved |
| `onboarding_step` | `integer` | NN, DEF `0` | текущий шаг онбординга, 0 — не начинался |
| `onboarding_done_at` | `timestamptz` |  | момент завершения онбординга |
| `morning_card_at` | `timestamptz` |  | когда показана карточка первого утра |
| `reminder_card_at` | `timestamptz` |  | когда показана карточка «Напомню в нужный момент» |
| `awaiting_input` | `text` |  | чего бот ждёт словами: name, morning, evening, city, promo, set:name / set:morning / set:evening / set:city, `edit:<id записи>`, `retime:<id записи>` |
| `awaiting_since` | `timestamptz` |  | момент нажатия «напишу своё», отсчёт окна ожидания |
| `preferred_name` | `text` |  | имя, выбранное человеком, вместо Telegram first_name |
| `updated_at` | `timestamptz` | NN, DEF `now()` | момент последнего изменения строки |

**Ограничения:** PRIMARY KEY (user_id).

**Индексы:** только индексы ограничений.

**Связи:** `user_id` → `users` (1:1, ON DELETE CASCADE).

**Физическая схема:** нарушение 1НФ. awaiting_input хранит составное значение (вид ожидания + id записи, например `edit:<id>`) — осознанное упрощение для короткоживущего состояния диалога. В логической модели — два поля: вид ожидания и ссылка на запись.

## messages_raw

Сырые входящие сообщения (текст, голос, аудио). Сохраняются до расшифровки и до обращения к ИИ, чтобы ничего не потерять; хранят расшифровку и привязку к выгрузке.

| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `uuid` | PK, DEF `gen_random_uuid()` | суррогатный ключ сообщения |
| `user_id` | `uuid` | FK → users.id (CASCADE), NN | автор сообщения |
| `update_id` | `bigint` | NN | update_id Telegram (логическая ссылка, без FK) |
| `tg_chat_id` | `bigint` | NN | ID чата Telegram |
| `tg_message_id` | `bigint` | NN | ID сообщения в чате Telegram |
| `tg_thread_id` | `bigint` |  | ветка (тема форума) личного чата, если есть |
| `kind` | `message_kind` | NN | вид сообщения: text/voice/audio/other |
| `text` | `text` |  | текст сообщения |
| `file_id` | `text` |  | file_id голосового или аудио в Telegram; обнуляется сразу после расшифровки (файл не хранится) |
| `audio_duration_sec` | `bigint` |  | длительность аудио в секундах |
| `transcript` | `text` |  | расшифровка голосового (модуль speech) |
| `batch_id` | `uuid` |  | выгрузка, в которую попало сообщение (без FK-ограничения) |
| `consumed_at` | `timestamptz` |  | сообщение использовано как ответ на вопрос бота и в разбор не идёт |
| `refused_reason` | `text` |  | почему сообщение не принято в разбор: trial / expired / renewalFailed / dumpLimit |
| `received_at` | `timestamptz` | NN, DEF `now()` | момент приёма сообщения |

**Ограничения:** PRIMARY KEY (id); `messages_raw_chat_message_uq`: UNIQUE btree (tg_chat_id, tg_message_id).

**Индексы:** `messages_raw_user_received_idx`: btree (user_id, received_at); `messages_raw_batch_idx`: btree (batch_id).

**Связи:** `user_id` → `users` (N:1, ON DELETE CASCADE). На таблицу ссылаются: `item_revisions.source_message_id`.

**Физическая схема:** денормализация. user_id при заполненном batch_id выводим через batches (в логической модели принадлежность к выгрузке — таблица batch_messages). batch_id и update_id — ссылки без FK: журнал апдейтов чистится через 24 ч, целостность batch_id обеспечивает код.

## batches

Выгрузка — серия сообщений, склеенная в одну «мысль» (закрывается после окна тишины). Единица обработки ИИ-конвейером: статус обработки, число попыток, учёт пробного периода.

| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `uuid` | PK, DEF `gen_random_uuid()` | суррогатный ключ выгрузки |
| `user_id` | `uuid` | FK → users.id (CASCADE), NN | владелец выгрузки |
| `status` | `batch_status` | NN, DEF `'open'` | статус: open/queued/processing/awaiting_answer/done/failed |
| `combined_text` | `text` |  | склейка расшифровок и текстов в порядке получения |
| `message_count` | `integer` | NN, DEF `0` | счётчик сообщений для потолка в 15 |
| `attempts` | `integer` | NN, DEF `0` | сколько раз обработка срывалась |
| `status_message_id` | `bigint` |  | ID единственного статусного сообщения в Telegram |
| `status_taken` | `boolean` | NN, DEF `false` | статусное сообщение занято ответом по существу |
| `status_updated_at` | `timestamptz` |  | когда статусное сообщение правилось |
| `mentioned_item_ids` | `uuid[]` |  | записи, упомянутые в выгрузке (массив без FK) |
| `opened_at` | `timestamptz` | NN, DEF `now()` | момент открытия выгрузки |
| `last_message_at` | `timestamptz` | NN, DEF `now()` | последнее сообщение, от него окно тишины |
| `closed_at` | `timestamptz` |  | момент закрытия выгрузки |
| `processing_at` | `timestamptz` |  | когда взяли в разбор (порог «застряла») |
| `processed_at` | `timestamptz` |  | когда разбор завершён |
| `trial_counted_at` | `timestamptz` |  | выгрузка потратила пробный период |
| `trial_over_at` | `timestamptz` |  | этой выгрузкой пробный период исчерпан (одна на человека) |
| `trial_limit` | `integer` |  | снимок предела пробного периода в тот момент |
| `error` | `text` |  | текст ошибки обработки |

**Ограничения:** PRIMARY KEY (id); `batches_one_open_per_user_uq`: UNIQUE btree (user_id) WHERE status = 'open'; `batches_trial_over_once_idx`: UNIQUE btree (user_id) WHERE trial_over_at IS NOT NULL; `batches_trial_over_pair`: CHECK ((trial_over_at IS NULL) = (trial_limit IS NULL)).

**Индексы:** `batches_status_opened_idx`: btree (status, opened_at); `batches_user_opened_idx`: btree (user_id, opened_at); `batches_trial_idx`: btree (user_id) WHERE trial_counted_at IS NOT NULL; `batches_trial_over_idx`: btree (trial_over_at) WHERE trial_over_at IS NOT NULL.

**Связи:** `user_id` → `users` (N:1, ON DELETE CASCADE). На таблицу ссылаются: `items.source_batch_id`, `ai_calls.batch_id`, `pending_questions.batch_id`, `misunderstood.batch_id`.

**Физическая схема:** нарушение 1НФ. mentioned_item_ids uuid[] — массив ссылок на items без FK (в логической модели — таблица-связка batch_mentions). combined_text (склейка текстов) и message_count (счётчик) — производные значения: снимок входа разбора и атомарный потолок числа сообщений.

## items

Запись — результат разбора потока мыслей: задача, желание, идея, информация или эмоция; приоритет, сфера, статус, срок, регулярность, смысловой вектор. Центральная сущность планирования.

| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `uuid` | PK, DEF `gen_random_uuid()` | суррогатный ключ записи |
| `user_id` | `uuid` | FK → users.id (CASCADE), NN | владелец записи |
| `source_batch_id` | `uuid` | FK → batches.id (SET NULL) | выгрузка, из которой родилась запись |
| `text` | `text` | NN | заголовок дела/мысли |
| `body` | `text` |  | подробности, добавленные к делу позже |
| `type` | `item_type` |  | тип: TASK / DESIRE / IDEA / INFO / EMOTION; у черновика пусто |
| `priority` | `item_priority` |  | приоритет: NOW / SOON / LATER / NONE |
| `topic_id` | `uuid` | FK → topics.id (SET NULL) | сфера записи (ссылка, источник истины) |
| `topic` | `text` |  | название сферы — кэш для показа без JOIN |
| `status` | `item_status` | NN, DEF `'new'` | статус жизненного цикла записи |
| `completed_at` | `timestamptz` |  | когда дело закрыли/выполнили последний раз |
| `is_project` | `boolean` | NN, DEF `false` | задача является большой целью с шагами |
| `backgrounded_at` | `timestamptz` |  | ушла в фон («начать с чистого листа») |
| `deferred_at` | `timestamptz` |  | ушла в «Позже»: срок снят |
| `offered_at` | `timestamptz` |  | когда последний раз предлагали утром из отложенного |
| `reviewed_at` | `timestamptz` |  | когда показана в разборе вчерашнего |
| `assignee` | `text` |  | кому можно передать дело (заметка) |
| `deadline_at` | `timestamptz` |  | срок записи |
| `deadline_accuracy` | `deadline_accuracy` |  | точность срока: day/week/month |
| `deadline_time` | `integer` |  | час срока — минуты от местной полуночи 0..1439 |
| `line_mentioned_at` | `timestamptz` |  | когда живая строка ответа упоминала запись |
| `embedding` | `vector(256)` |  | смысловой вектор текста (Yandex text-search-doc) |
| `recurrence_rule` | `jsonb` |  | правило повторения {kind, interval, anchor, days?} |
| `recurrence_text` | `text` |  | фраза человека о повторе: «каждый вторник» |
| `recurrence_source` | `recurrence_source` |  | откуда регулярность: stated/asked/noticed/history |
| `source_order` | `integer` |  | порядок записи внутри своей выгрузки |
| `is_draft` | `boolean` | NN, DEF `false` | черновик: разобрать не удалось |
| `draft_reason` | `text` |  | ошибка и сырой ответ модели для черновика |
| `created_at` | `timestamptz` | NN, DEF `now()` | момент создания записи |
| `updated_at` | `timestamptz` | NN, DEF `now()` | момент последнего изменения |

**Ограничения:** PRIMARY KEY (id); `items_draft_or_classified`: CHECK ((is_draft = true) OR (type IS NOT NULL AND priority IS NOT NULL AND topic IS NOT NULL)); `items_recurrence_task_only`: CHECK (recurrence_rule IS NULL OR type = 'TASK'); `items_recurrence_has_source`: CHECK ((recurrence_rule IS NULL AND recurrence_text IS NULL) OR recurrence_source IS NOT NULL); `items_deadline_with_accuracy`: CHECK ((deadline_at IS NULL) = (deadline_accuracy IS NULL)); `items_deadline_time_day_only`: CHECK (deadline_time IS NULL OR (deadline_accuracy IS NOT NULL AND deadline_accuracy = 'day' AND deadline_time BETWEEN 0 AND 1439)).

**Индексы:** `items_user_status_priority_idx`: btree (user_id, status, priority); `items_user_deadline_idx`: btree (user_id, deadline_at); `items_source_batch_idx`: btree (source_batch_id); `items_drafts_idx`: btree (created_at) WHERE is_draft = true; `items_user_active_idx`: btree (user_id) WHERE backgrounded_at IS NULL.

Векторного индекса (HNSW/IVFFlat) нет: поиск похожих записей — точный перебор по косинусному расстоянию `<=>` в пределах одного пользователя. Частичный индекс `items_user_active_idx` создан ручной SQL-миграцией и отсутствует в схеме Drizzle.

**Связи:** `user_id` → `users` (N:1, ON DELETE CASCADE); `source_batch_id` → `batches` (N:0..1, ON DELETE SET NULL); `topic_id` → `topics` (N:0..1, ON DELETE SET NULL). На таблицу ссылаются: `item_revisions.item_id`, `pending_questions.item_id`, `recurrence_suggestions.item_id`, `project_steps.item_id`, `reminders.item_id`.

**Физическая схема:** денормализация. user_id выводим через source_batch_id (и topic_id) — дублирование владельца для выборок по пользователю. topic — название сферы от классификатора: при заполненном topic_id совпадает с topics.name (кэш), при пустом — самостоятельное значение; CHECK разобранной записи опирается на topic. embedding — кэш внешней модели, пересчитывается после правки заголовка вне транзакции (при сбое — ручной досчёт). recurrence_rule (jsonb) — неделимый объект-значение правила повторения.

## topics

Сферы жизни пользователя (семья, работа, здоровье…): название, эмодзи, порядок, привязка к ветке (теме форума) личного чата Telegram.

| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `uuid` | PK, DEF `gen_random_uuid()` | суррогатный ключ сферы |
| `user_id` | `uuid` | FK → users.id (CASCADE), NN | владелец сферы |
| `name` | `text` | NN | название сферы, уникально у пользователя |
| `emoji` | `text` |  | эмодзи-маркер сферы |
| `sort_order` | `integer` | NN, DEF `0` | порядок показа сфер |
| `tg_thread_id` | `integer` |  | ветка (тема форума) личного чата Telegram для сферы |
| `summary_message_id` | `integer` |  | ID сообщения-сводки сферы в её ветке |
| `is_default` | `boolean` | NN, DEF `false` | сфера по умолчанию для нераспознанного |
| `is_archived` | `boolean` | NN, DEF `false` | сфера в архиве |
| `created_at` | `timestamptz` | NN, DEF `now()` | момент создания сферы |

**Ограничения:** PRIMARY KEY (id); `topics_user_name_uq`: UNIQUE btree (user_id, name); `topics_user_thread_uq`: UNIQUE btree (user_id, tg_thread_id) WHERE tg_thread_id IS NOT NULL.

**Индексы:** `topics_user_sort_idx`: btree (user_id, sort_order).

**Связи:** `user_id` → `users` (N:1, ON DELETE CASCADE). На таблицу ссылаются: `items.topic_id`.

**Физическая схема:** 3НФ.

## item_revisions

История изменений записи: кто и почему изменил, полные снимки «до» и «после». Позволяет откатить изменение одной кнопкой.

| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `uuid` | PK, DEF `gen_random_uuid()` | суррогатный ключ ревизии |
| `item_id` | `uuid` | FK → items.id (CASCADE), NN | изменённая запись |
| `user_id` | `uuid` | FK → users.id (CASCADE), NN | владелец — прямая связь для удаления и экспорта данных человека |
| `changed_by` | `changed_by` | NN | источник изменения: user/resolver/scheduler/admin |
| `reason` | `text` |  | почему изменено: строка решения резолвера |
| `before` | `jsonb` | NN | полный снимок строки записи до изменения |
| `after` | `jsonb` | NN | полный снимок строки записи после изменения |
| `source_message_id` | `uuid` | FK → messages_raw.id (SET NULL) | сообщение, вызвавшее изменение |
| `reverted_at` | `timestamptz` |  | момент отката; пусто — ревизия в силе |
| `created_at` | `timestamptz` | NN, DEF `now()` | момент изменения |

**Ограничения:** PRIMARY KEY (id).

**Индексы:** `item_revisions_item_created_idx`: btree (item_id, created_at); `item_revisions_user_idx`: btree (user_id).

**Связи:** `item_id` → `items` (N:1, ON DELETE CASCADE); `user_id` → `users` (N:1, ON DELETE CASCADE); `source_message_id` → `messages_raw` (N:0..1, ON DELETE SET NULL).

**Физическая схема:** денормализация. Журнал: before/after — снимки строки items в jsonb. user_id дублирует владельца записи для удаления и экспорта данных по прямой связи.

## pending_questions

Открытый уточняющий вопрос бота («добавить к прошлой записи или это новое?») с отложенным действием. Не более одного открытого вопроса на пользователя.

| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `uuid` | PK, DEF `gen_random_uuid()` | суррогатный ключ вопроса |
| `user_id` | `uuid` | FK → users.id (CASCADE), NN | кому задан вопрос |
| `item_id` | `uuid` | FK → items.id (CASCADE), NN | запись, о которой спрашиваем |
| `batch_id` | `uuid` | FK → batches.id (CASCADE), NN | выгрузка, из которой родился вопрос |
| `segment` | `text` | NN | сказанное человеком, что не должно потеряться |
| `action` | `text` | NN | действие резолвера: update/complete/cancel/new |
| `changes` | `jsonb` | NN | изменения, которые будут применены после ответа (JSON) |
| `mode` | `text` |  | append (дополнить) или replace (заменить); NULL — замена |
| `expires_at` | `timestamptz` | NN | когда вопрос истекает (код: +6 часов) |
| `resolved_at` | `timestamptz` |  | момент закрытия; пусто — вопрос открыт |
| `outcome` | `question_outcome` |  | исход: attached/separate/timeout/superseded |
| `created_at` | `timestamptz` | NN, DEF `now()` | момент постановки вопроса |

**Ограничения:** PRIMARY KEY (id); `pending_questions_open_uq`: UNIQUE btree (user_id) WHERE resolved_at IS NULL.

**Индексы:** `pending_questions_expires_idx`: btree (expires_at).

**Связи:** `user_id` → `users` (N:1, ON DELETE CASCADE); `item_id` → `items` (N:1, ON DELETE CASCADE); `batch_id` → `batches` (N:1, ON DELETE CASCADE).

**Физическая схема:** денормализация. changes (jsonb) — сериализованная отложенная команда. user_id дублирован ради частичного уникального индекса «один открытый вопрос на человека».

## recurrence_suggestions

Предложение бота запомнить регулярность дела: связка похожих записей, найденный ритм и ответ пользователя.

| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `uuid` | PK, DEF `gen_random_uuid()` | суррогатный ключ предложения |
| `user_id` | `uuid` | FK → users.id (CASCADE), NN | кому предложено |
| `item_id` | `uuid` | FK → items.id (CASCADE), NN | запись, о которой спросили (с неё начался поиск ритма) |
| `item_ids` | `jsonb` | NN | вся связка записей — массив id без FK |
| `kind` | `text` | NN | вид ритма: daily/weekly/monthly/yearly |
| `interval` | `integer` | NN | шаг ритма в периодах |
| `outcome` | `suggestion_outcome` |  | исход: accepted/declined/ignored |
| `resolved_at` | `timestamptz` |  | момент ответа человека |
| `created_at` | `timestamptz` | NN, DEF `now()` | момент предложения (задаётся кодом) |

**Ограничения:** PRIMARY KEY (id).

**Индексы:** `recurrence_suggestions_user_created_idx`: btree (user_id, created_at).

**Связи:** `user_id` → `users` (N:1, ON DELETE CASCADE); `item_id` → `items` (N:1, ON DELETE CASCADE).

**Физическая схема:** нарушение 1НФ. item_ids (jsonb) — массив id связки записей без FK (в логической модели — таблица-связка suggestion_items). item_id — запись, о которой спросили; user_id дублирует её владельца.

## project_steps

Шаги большой цели (записи-проекта): упорядоченный список с отметкой выполнения; пользователю показывается ближайший незакрытый шаг.

| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `uuid` | PK, DEF `gen_random_uuid()` | суррогатный ключ шага |
| `item_id` | `uuid` | FK → items.id (CASCADE), NN | запись-проект, к которой относится шаг |
| `user_id` | `uuid` | FK → users.id (CASCADE), NN | владелец шага (дублирует владельца проекта) |
| `text` | `text` | NN | формулировка шага |
| `position` | `integer` | NN | порядковый номер шага в проекте |
| `done_at` | `timestamptz` |  | момент выполнения шага |
| `created_at` | `timestamptz` | NN, DEF `now()` | момент создания шага |

**Ограничения:** PRIMARY KEY (id); `project_steps_item_position_uq`: UNIQUE btree (item_id, position).

**Индексы:** `project_steps_user_idx`: btree (user_id).

**Связи:** `item_id` → `items` (N:1, ON DELETE CASCADE); `user_id` → `users` (N:1, ON DELETE CASCADE).

**Физическая схема:** денормализация. user_id зависит от item_id (владелец проекта) — частичная зависимость от потенциального ключа (item_id, position); нужен для проверки владельца при нажатии кнопки и экспорта данных.

## reminders

Запланированные напоминания и сводки: вид, момент отправки, ключ идемпотентности, отметка отправки, причина пропуска.

| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `uuid` | PK, DEF `gen_random_uuid()` | суррогатный ключ напоминания (uuid, генерируется БД) |
| `user_id` | `uuid` | FK → users.id (CASCADE), NN | кому напоминание |
| `item_id` | `uuid` | FK → items.id (CASCADE) | запись; пусто у утренних и вечерних |
| `kind` | `reminder_kind` | NN | вид напоминания |
| `due_at` | `timestamptz` | NN | момент отправки в UTC |
| `dedupe_key` | `text` | NN | ключ идемпотентности: вид[:id записи]:местная дата[:ЧЧ:ММ], например morning:2026-08-30 |
| `sent_at` | `timestamptz` |  | момент отправки; пусто — не отправлено |
| `attempts` | `integer` | NN, DEF `0` | сколько раз отправка сорвалась |
| `skipped_reason` | `text` |  | код причины, по которой напоминание не отправлено |
| `created_at` | `timestamptz` | NN, DEF `now()` | момент раскладки |

**Ограничения:** PRIMARY KEY (id); `reminders_user_key_uq`: UNIQUE btree (user_id, dedupe_key).

**Индексы:** `reminders_pending_idx`: btree (due_at); `reminders_user_kind_idx`: btree (user_id, kind).

**Связи:** `user_id` → `users` (N:1, ON DELETE CASCADE); `item_id` → `items` (N:0..1, ON DELETE CASCADE).

**Физическая схема:** денормализация. dedupe_key — снимок «вид[:id записи]:день срока или отправки[:ЧЧ:ММ]» на момент раскладки; kind и item_id выводимы из него (частичная зависимость от потенциального ключа (user_id, dedupe_key)). user_id — единственная связь у утренних и вечерних сводок, у напоминаний о деле дублирует владельца записи.

## promo_codes

Промокоды на первый период подписки: фиксированная цена в рублях и в звёздах Telegram, срок действия, лимит применений.

| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `code` | `text` | PK | Сам промокод |
| `plan` | `billing_plan` | NN | Тариф, на который действует код (monthly/yearly) |
| `price_rub_minor` | `integer` | NN | Цена первого периода в копейках |
| `price_stars` | `integer` | NN | Цена первого периода в звёздах |
| `valid_until` | `timestamptz` |  | Срок действия; NULL — бессрочно |
| `max_redemptions` | `integer` |  | Лимит оплаченных применений; NULL — без ограничения |
| `note` | `text` |  | кому и для какого канала выдан код |
| `created_at` | `timestamptz` | NN, DEF `now()` | Когда код заведён |
| `disabled_at` | `timestamptz` |  | Когда выключен вручную (удалять нельзя) |

**Ограничения:** PRIMARY KEY (code); `promo_price_rub_positive`: CHECK (price_rub_minor > 0); `promo_price_stars_positive`: CHECK (price_stars > 0); `promo_max_positive`: CHECK (max_redemptions IS NULL OR max_redemptions > 0).

**Индексы:** только индексы ограничений.

**Связи:** внешних ключей нет. На таблицу ссылаются: `billing_invoices.promo_code`.

**Физическая схема:** 3НФ. Число применений не хранится — считается по billing_invoices.

## billing_invoices

Счёт — одна строка на каждую попытку оплаты (включая продления) через Робокассу или Telegram Stars.

| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `uuid` | PK, DEF `gen_random_uuid()` | Идентификатор счёта |
| `provider` | `text` | NN | платёжный канал: Робокасса или Telegram Stars |
| `user_id` | `uuid` | FK → users.id (SET NULL) | Плательщик; NULL после удаления данных (обезличен) |
| `plan` | `billing_plan` | NN | Тариф: monthly или yearly |
| `kind` | `billing_charge_kind` | NN | initial — первый платёж, renewal — продление |
| `inv_id` | `bigint` | UQ | Наш номер счёта для Робокассы (из billing_inv_id_seq) |
| `provider_inv_id` | `bigint` |  | Фактический номер счёта из уведомления провайдера |
| `parent_inv_id` | `bigint` |  | номер материнского платежа у провайдера (для продлений) |
| `amount_minor` | `integer` | NN | Сумма: копейки (RUB) или штуки звёзд (XTR) |
| `currency` | `text` | NN | валюта: RUB или XTR (определяется платёжным каналом) |
| `out_sum_sent` | `text` |  | Сумма строкой, как отправлена (для подписи) |
| `out_sum_received` | `text` |  | Сумма строкой, как пришла в уведомлении |
| `status` | `billing_invoice_status` | NN, DEF `'created'` | created / paid / failed / expired / canceled / refunded |
| `ref` | `text` | NN | Наша случайная метка, возвращается в уведомлении |
| `promo_code` | `text` | FK → promo_codes.code (SET NULL) | Промокод, по которому выставлен счёт |
| `amount_full_minor` | `integer` |  | Цена без скидки (снимок) для расчёта недополученного |
| `auto_renew` | `boolean` |  | Обещал ли провайдер автопродление; NULL — не обещал |
| `renews_period_end` | `timestamptz` |  | Конец периода, оплачиваемого продлением; ключ идемпотентности |
| `receipt_status` | `text` | NN, DEF `'unknown'` | состояние фискального чека (автоматического обновления нет) |
| `error_code` | `integer` |  | код ошибки провайдера |
| `error_text` | `text` |  | Текст ошибки провайдера |
| `created_at` | `timestamptz` | NN, DEF `now()` | Когда счёт заведён (нажатие кнопки) |
| `paid_at` | `timestamptz` |  | Когда оплата подтверждена уведомлением |
| `refunded_at` | `timestamptz` |  | Когда деньги вернулись |
| `failed_at` | `timestamptz` |  | Когда счёт стал неудачным; NULL у старых |
| `expires_at` | `timestamptz` |  | До какого момента счёт можно оплатить |

**Ограничения:** PRIMARY KEY (id); `billing_promo_once_idx`: UNIQUE btree (user_id) WHERE promo_code IS NOT NULL AND user_id IS NOT NULL AND status NOT IN ('failed','refunded'); `billing_renewal_once_idx`: UNIQUE btree (provider, user_id, renews_period_end) WHERE renews_period_end IS NOT NULL; `billing_invoices_inv_id_key`: UNIQUE (inv_id).

**Индексы:** `billing_invoices_user_idx`: btree (user_id, created_at DESC); `billing_invoices_provider_inv_idx`: btree (provider, provider_inv_id); `billing_invoices_ref_idx`: btree (provider, ref); `billing_invoices_promo_idx`: btree (promo_code) WHERE promo_code IS NOT NULL.

Ограничение уникальности `inv_id` объявлено в SQL-миграции прямо в столбце, поэтому в БД оно называется по умолчанию `billing_invoices_inv_id_key` (в снимке Drizzle — `billing_invoices_inv_id_unique`).

**Связи:** `user_id` → `users` (N:0..1, ON DELETE SET NULL); `promo_code` → `promo_codes` (N:0..1, ON DELETE SET NULL). На таблицу ссылаются: `billing_events.invoice_id`, `billing_consents.invoice_id`.

**Физическая схема:** денормализация. Финансовый документ: currency определяется платёжным каналом (provider → currency), суммы — снимок цены на момент выставления счёта.

## billing_subscriptions

Подписка пользователя в конкретном платёжном канале: тариф, статус, автопродление, конец оплаченного периода. Не более одной на пользователя и канал.

| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `uuid` | PK, DEF `gen_random_uuid()` | Идентификатор подписки |
| `provider` | `text` | NN | платёжный канал: Робокасса или Telegram Stars |
| `user_id` | `uuid` | FK → users.id (CASCADE), NN | Владелец подписки |
| `plan` | `billing_plan` | NN | Тариф: monthly или yearly |
| `status` | `billing_sub_status` | NN, DEF `'active'` | active / past_due / canceled / expired |
| `auto_renew` | `boolean` | NN, DEF `true` | Включено ли автопродление (источник правды) |
| `current_period_end` | `timestamptz` | NN | До какого момента оплачен доступ |
| `subscription_ref` | `text` |  | Ключ отмены у провайдера (у звёзд telegram_payment_charge_id) |
| `canceled_at` | `timestamptz` |  | Когда человек отменил автопродление |
| `last_renewal_at` | `timestamptz` |  | Когда последний раз прошло продление |
| `renewal_noticed_for` | `timestamptz` |  | Конец периода, о списании за который предупредили |
| `created_at` | `timestamptz` | NN, DEF `now()` | Когда подписка заведена |
| `updated_at` | `timestamptz` | NN, DEF `now()` | Когда строка последний раз изменена |

**Ограничения:** PRIMARY KEY (id); `billing_subscriptions_one_idx`: UNIQUE btree (user_id, provider).

**Индексы:** только индексы ограничений.

**Связи:** `user_id` → `users` (N:1, ON DELETE CASCADE).

**Физическая схема:** 3НФ.

## billing_events

Журнал уведомлений платёжных провайдеров; уникальность (provider, external_id, kind) защищает от повторной обработки платежа.

| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `uuid` | PK, DEF `gen_random_uuid()` | Идентификатор события |
| `provider` | `text` | NN | Рельс, от которого пришло событие |
| `external_id` | `text` | NN | Ключ провайдера: InvId / charge_id / kind:ref[:период] |
| `kind` | `text` | NN | paid / refunded / renewalStopped / renewalFailed / forged |
| `method` | `text` |  | как пришло: GET, POST (Робокасса), stars (Telegram) или opstate (сверка состояния операции) |
| `signature_ok` | `boolean` | NN | Сошлась ли подпись уведомления |
| `payload` | `jsonb` | NN | тело уведомления без персональных данных |
| `invoice_id` | `uuid` | FK → billing_invoices.id (SET NULL) | Счёт, к которому относится событие |
| `received_at` | `timestamptz` | NN, DEF `now()` | Когда событие получено |
| `processed_at` | `timestamptz` |  | Когда событие обработано |

**Ограничения:** PRIMARY KEY (id); `billing_events_once_idx`: UNIQUE btree (provider, external_id, kind).

**Индексы:** `billing_events_received_idx`: btree (received_at DESC).

**Связи:** `invoice_id` → `billing_invoices` (N:0..1, ON DELETE SET NULL).

**Физическая схема:** денормализация. invoice_id зависит от (provider, external_id) — части ключа идемпотентности (у Stars события paid и refunded одного платежа имеют один external_id). payload (jsonb) — сырой документ провайдера без персональных данных, хранится целиком.

## billing_price_changes

История изменения цены для продлений действующих подписок, с датой вступления в силу.

| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `uuid` | PK, DEF `gen_random_uuid()` | Идентификатор перемены цены |
| `rail` | `text` | NN | платёжный канал, для которого меняется цена |
| `plan` | `billing_plan` | NN | Тариф, для которого меняется цена |
| `amount_minor` | `integer` | NN | Новая цена в минимальных единицах |
| `currency` | `text` | NN | Валюта: RUB или XTR |
| `announced_at` | `timestamptz` | NN, DEF `now()` | Когда бот заметил новую цену в панели |
| `effective_at` | `timestamptz` | NN | С какого момента продления списывают эту сумму |
| `notified` | `integer` | NN, DEF `0` | Сколько подписчиков предупреждено о перемене |
| `canceled_at` | `timestamptz` |  | Когда перемену отменили до вступления в силу |

**Ограничения:** PRIMARY KEY (id).

**Индексы:** только индексы ограничений.

**Связи:** внешних ключей нет.

**Физическая схема:** денормализация. Журнал цен; currency определяется каналом (rail → currency), но хранится для самодостаточности записи.

## billing_consents

История согласий пользователя на автосписания: что было показано (сумма, тариф, периодичность, редакция оферты) и когда.

| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `uuid` | PK, DEF `gen_random_uuid()` | Идентификатор согласия |
| `user_id` | `uuid` | FK → users.id (SET NULL) | Кто согласился; NULL после удаления данных |
| `rail` | `text` | NN | платёжный канал, на котором дано согласие |
| `plan` | `billing_plan` | NN | Тариф (сейчас всегда monthly) |
| `amount_minor` | `integer` | NN | Сумма, которую человек видел на экране |
| `currency` | `text` | NN | Валюта, которую человек видел: RUB или XTR |
| `offer_url` | `text` | NN | Адрес оферты на кнопке в момент согласия |
| `offer_edition` | `text` |  | редакция оферты; NULL — документы без даты |
| `period` | `text` | NN | Периодичность списаний ISO 8601, напр. P1M |
| `invoice_id` | `uuid` | FK → billing_invoices.id (SET NULL) | Счёт по согласию; NULL — счёт не удался |
| `consented_at` | `timestamptz` | NN, DEF `now()` | Момент согласия |

**Ограничения:** PRIMARY KEY (id).

**Индексы:** `billing_consents_user_idx`: btree (user_id).

**Связи:** `user_id` → `users` (N:0..1, ON DELETE SET NULL); `invoice_id` → `billing_invoices` (N:0..1, ON DELETE SET NULL).

**Физическая схема:** денормализация. Юридическая запись-снимок показанного пользователю: дублирует параметры счёта, потому что пишется до его создания; currency определяется каналом, period — тарифом.

## telegram_updates

Журнал обработанных update_id Telegram для идемпотентности: Telegram может прислать один апдейт повторно. Записи старше 24 ч удаляются.

| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `update_id` | `bigint` | PK | update_id Telegram, естественный ключ |
| `received_at` | `timestamptz` | NN, DEF `now()` | момент приёма апдейта, для чистки журнала |

**Ограничения:** PRIMARY KEY (update_id).

**Индексы:** `telegram_updates_received_at_idx`: btree (received_at).

**Связи:** внешних ключей нет.

**Физическая схема:** 3НФ.

## prompt_versions

Версии промптов для этапов ИИ-конвейера. На этап — не более одной активной версии (частичный UNIQUE); что активная версия есть, проверяет код. Правятся из админ-панели без выкладки.

| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `uuid` | PK, DEF `gen_random_uuid()` | суррогатный ключ версии промпта |
| `stage` | `ai_stage` | NN | этап ИИ-конвейера, для которого промпт |
| `version` | `text` | NN | читаемая метка версии, напр. extractor@3 |
| `prompt` | `text` | NN | текст промпта |
| `schema_name` | `text` | NN | имя Zod-схемы валидатора в коде |
| `schema_json` | `jsonb` | NN | JSON-схема ответа, передаваемая модели |
| `note` | `text` |  | зачем появилась версия |
| `is_active` | `boolean` | NN, DEF `false` | активная версия этапа |
| `created_at` | `timestamptz` | NN, DEF `now()` | момент создания версии |

**Ограничения:** PRIMARY KEY (id); `prompt_versions_stage_version_uq`: UNIQUE btree (stage, version); `prompt_versions_one_active_per_stage_uq`: UNIQUE btree (stage) WHERE is_active.

**Индексы:** только индексы ограничений.

**Связи:** внешних ключей нет.

**Физическая схема:** 3НФ. schema_json — снимок JSON-схемы на момент создания версии; при загрузке сверяется со схемой, которую сейчас порождает код, чтобы поймать «промпт откатили, а схему нет».

## ai_calls

Журнал каждого обращения к моделям ИИ (распознавание речи, YandexGPT, эмбеддинги): этап, модель, токены, стоимость, задержка, успех или ошибка.

| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `uuid` | PK, DEF `gen_random_uuid()` | суррогатный ключ вызова |
| `user_id` | `uuid` | FK → users.id (SET NULL) | чей вызов; обнуляется при удалении человека |
| `batch_id` | `uuid` | FK → batches.id (SET NULL) | выгрузка, в рамках которой вызов |
| `stage` | `ai_stage` | NN | этап конвейера ИИ |
| `model` | `text` | NN | имя модели в запросе |
| `model_version` | `text` |  | версия модели, которой ответил провайдер |
| `prompt_version` | `text` |  | метка версии промпта (логическая ссылка, без FK) |
| `tokens_in` | `integer` |  | входные токены |
| `tokens_out` | `integer` |  | выходные токены |
| `audio_seconds` | `integer` |  | секунды аудио для распознавания |
| `cost_micros` | `bigint` |  | стоимость в микроединицах валюты; NULL — цена неизвестна |
| `cost_currency` | `currency` |  | валюта стоимости: usd/rub |
| `latency_ms` | `integer` | NN | задержка вызова, мс |
| `ok` | `boolean` | NN | вызов успешен |
| `error` | `text` |  | текст ошибки |
| `created_at` | `timestamptz` | NN, DEF `now()` | момент вызова |

**Ограничения:** PRIMARY KEY (id).

**Индексы:** `ai_calls_user_created_idx`: btree (user_id, created_at); `ai_calls_batch_idx`: btree (batch_id); `ai_calls_stage_created_idx`: btree (stage, created_at); `ai_calls_failed_idx`: btree (created_at) WHERE ok = false.

**Связи:** `user_id` → `users` (N:0..1, ON DELETE SET NULL); `batch_id` → `batches` (N:0..1, ON DELETE SET NULL).

**Физическая схема:** денормализация. Журнал. cost_micros — снимок цены на момент вызова (прайс меняется). user_id при заполненном batch_id выводим через batches, но нужен для обезличивания и отчётов.

## app_settings

Системные настройки продукта «ключ — значение» (пробный период, лимиты, цены, выключатели функций); правятся из админ-панели.

| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `key` | `text` | PK | Имя настройки, напр. trial.dumps, price.monthly_rub_minor |
| `value` | `text` | NN | Значение строкой; тип разбирает читающий код |
| `updated_at` | `timestamptz` | NN, DEF `now()` | Когда значение последний раз изменено |
| `updated_by` | `text` |  | Логин администратора панели (не FK: админы в env) |

**Ограничения:** PRIMARY KEY (key).

**Индексы:** только индексы ограничений.

**Связи:** внешних ключей нет.

**Физическая схема:** 3НФ. Паттерн «ключ — значение»: новая настройка не требует миграции, типы и диапазоны проверяет код.

## documents

Публичные юридические документы (оферта, политика конфиденциальности, соглашение, согласие на обработку ПД) — текущая редакция, отдаётся по адресу `/docs/<slug>`.

| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `slug` | `text` | PK | Код документа в адресе `/docs/<slug>` |
| `title` | `text` | NN | заголовок документа (задан в коде для каждого slug) |
| `html` | `text` | NN | Текущая разметка после санитайзинга |
| `edition_date` | `date` |  | Дата редакции из шапки; NULL — не назначена |
| `updated_at` | `timestamptz` | NN, DEF `now()` | Когда сохранена текущая версия |
| `updated_by` | `text` |  | Логин администратора, сохранившего версию |

**Ограничения:** PRIMARY KEY (slug).

**Индексы:** только индексы ограничений.

**Связи:** внешних ключей нет. На таблицу ссылаются: `document_versions.slug`.

**Физическая схема:** денормализация. html, edition_date, updated_at, updated_by совпадают с последней строкой document_versions — материализованная текущая редакция (запись в одной транзакции) для быстрой отдачи страницы.

## document_versions

История версий документов: каждое сохранение — отдельная строка (для отката и доказательства действовавшей редакции).

| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `uuid` | PK, DEF `gen_random_uuid()` | Идентификатор версии |
| `slug` | `text` | FK → documents.slug (CASCADE), NN | Документ, к которому относится версия |
| `html` | `text` | NN | Разметка этой версии |
| `edition_date` | `date` |  | Дата редакции на момент сохранения |
| `saved_at` | `timestamptz` | NN, DEF `now()` | Момент сохранения версии |
| `saved_by` | `text` |  | Логин администратора, сохранившего версию |

**Ограничения:** PRIMARY KEY (id).

**Индексы:** `document_versions_slug_idx`: btree (slug, saved_at).

**Связи:** `slug` → `documents` (N:1, ON DELETE CASCADE).

**Физическая схема:** 3НФ. Журнал версий (только добавление).

## text_overrides

Реплики бота, изменённые из админ-панели. Хранятся только переопределения: нет строки — действует текст из кода.

| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `path` | `text` | PK | Путь реплики в словаре, напр. answer.acknowledgement |
| `value` | `text` | NN | Новый текст; подстановки {1},{2} проверяются при записи |
| `updated_at` | `timestamptz` | NN, DEF `now()` | Когда реплика изменена |
| `updated_by` | `text` |  | Логин администратора, изменившего реплику |

**Ограничения:** PRIMARY KEY (path).

**Индексы:** `text_overrides_updated_idx`: btree (updated_at DESC).

**Связи:** внешних ключей нет.

**Физическая схема:** 3НФ.

## misunderstood

Журнал «непонятого»: что сказал пользователь и что ответил бот, когда не смог разобрать сообщение.

| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `uuid` | PK, DEF `gen_random_uuid()` | Идентификатор записи |
| `user_id` | `uuid` | FK → users.id (CASCADE), NN | Пользователь, которого бот не понял |
| `batch_id` | `uuid` | FK → batches.id (SET NULL) | Выгрузка, на которую бот сдался |
| `said` | `text` | NN | Копия сказанного человеком — выгрузка целиком |
| `replied` | `text` | NN | Ответ бота дословно, как ушёл |
| `reason` | `text` | NN | ключ реплики отказа в словаре реплик, например backlog.nothing |
| `kind` | `text` | NN, DEF `'meaning'` | вид отказа: meaning (не понял) или system (сбой) |
| `created_at` | `timestamptz` | NN, DEF `now()` | момент отправки реплики отказа |

**Ограничения:** PRIMARY KEY (id).

**Индексы:** `misunderstood_created_idx`: btree (created_at); `misunderstood_user_idx`: btree (user_id, created_at).

**Связи:** `user_id` → `users` (N:1, ON DELETE CASCADE); `batch_id` → `batches` (N:0..1, ON DELETE SET NULL).

**Физическая схема:** денормализация. said — снимок сказанного рядом с ответом бота (журнал). user_id хранится отдельно от batch_id, который может обнулиться.

## admin_access_log

Журнал доступа администратора к персональным данным: кто, в какой раздел панели, к чьим данным и когда.

| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `uuid` | PK, DEF `gen_random_uuid()` | Идентификатор записи журнала |
| `login` | `text` | NN | Логин смотревшего администратора (админы в env) |
| `route` | `text` | NN | Путь раздела панели, к которому обращались |
| `subject_user_id` | `uuid` | FK → users.id (SET NULL) | Чьи данные смотрели; NULL — многих сразу |
| `subjects` | `integer` |  | Сколько человек попало в ответ; NULL — не установлено |
| `at` | `timestamptz` | NN, DEF `now()` | Момент обращения |

**Ограничения:** PRIMARY KEY (id).

**Индексы:** `admin_access_at_idx`: btree (at DESC); `admin_access_subject_idx`: btree (subject_user_id).

**Связи:** `subject_user_id` → `users` (N:0..1, ON DELETE SET NULL).

**Физическая схема:** 3НФ. Журнал событий; администратор — внешний актор (учётные данные в окружении), поэтому login без FK.

## broadcasts

Рассылка администратора: текст, сегмент получателей, статус, автор, время запуска и окончания.

| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `uuid` | PK, DEF `gen_random_uuid()` | Идентификатор рассылки |
| `text` | `text` | NN | Текст сообщения; неизменен после старта |
| `segment` | `text` | NN, DEF `'all'` | кому: all или имя сегмента (trialLeft, trialSpent) |
| `status` | `text` | NN, DEF `'draft'` | draft / running / stopped / done / failed |
| `created_by` | `text` | NN | Логин администратора, создавшего рассылку |
| `stop_requested_at` | `timestamptz` |  | Когда попросили остановить (статус ставит воркер) |
| `created_at` | `timestamptz` | NN, DEF `now()` | Когда рассылка составлена |
| `started_at` | `timestamptz` |  | Когда отправка началась |
| `finished_at` | `timestamptz` |  | Когда отправка закончилась |

**Ограничения:** PRIMARY KEY (id).

**Индексы:** `broadcasts_created_idx`: btree (created_at DESC).

**Связи:** внешних ключей нет. На таблицу ссылаются: `broadcast_deliveries.broadcast_id`.

**Физическая схема:** 3НФ. Счётчиков нет намеренно — прогресс считается по broadcast_deliveries.

## broadcast_deliveries

Доставка рассылки конкретному пользователю — связующая таблица N:M между broadcasts и users с атрибутами доставки.

| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `uuid` | PK, DEF `gen_random_uuid()` | Идентификатор доставки |
| `broadcast_id` | `uuid` | FK → broadcasts.id (CASCADE), NN | Рассылка, к которой относится доставка |
| `user_id` | `uuid` | FK → users.id (CASCADE), NN | Получатель |
| `tg_id` | `bigint` | NN | Копия Telegram-id получателя — куда фактически ушло |
| `status` | `text` | NN, DEF `'pending'` | pending / sending / sent / skipped / failed |
| `error` | `text` |  | Текст ошибки отправки |
| `at` | `timestamptz` |  | Момент отправки/взятия строки воркером |

**Ограничения:** PRIMARY KEY (id); `broadcast_once_idx`: UNIQUE btree (broadcast_id, user_id).

**Индексы:** `broadcast_pending_idx`: btree (broadcast_id, status).

**Связи:** `broadcast_id` → `broadcasts` (N:1, ON DELETE CASCADE); `user_id` → `users` (N:1, ON DELETE CASCADE).

**Физическая схема:** денормализация. Связующая таблица N:M. tg_id совпадает с users.tg_id (ID Telegram неизменен) — зависит от части ключа (broadcast_id, user_id); хранится как адрес фактической доставки.

## Перечисления (ENUM)

| Тип | Значения |
|---|---|
| `message_kind` | text, voice, audio, other |
| `batch_status` | open, queued, processing, awaiting_answer, done, failed |
| `ai_stage` | speech, router, extractor, classifier, resolver, presenter, decomposer, embedder, answerer, reader, talker, splitter |
| `item_type` | TASK, DESIRE, IDEA, INFO, EMOTION |
| `item_status` | new, active, in_progress, waiting, delegated, done, snoozed, cancelled |
| `item_priority` | NOW, SOON, LATER, NONE |
| `deadline_accuracy` | day, week, month |
| `recurrence_source` | stated, asked, noticed, history |
| `currency` | usd, rub |
| `changed_by` | user, resolver, scheduler, admin |
| `question_outcome` | attached, separate, timeout, superseded |
| `suggestion_outcome` | accepted, declined, ignored |
| `reminder_kind` | morning, evening, deadline_eve, deadline_day, deadline_hour, project, period |
| `billing_plan` | monthly, yearly |
| `billing_charge_kind` | initial, renewal |
| `billing_invoice_status` | created, paid, failed, expired, canceled, refunded |
| `billing_sub_status` | active, past_due, canceled, expired |

## Внешние ключи и индексы на них

Индекс пригоден для внешнего ключа, если FK-колонка в нём **первая**, а частичный индекс — только с условием `<колонка> IS NOT NULL` (оно следует из `колонка = $1`; индекс с другим условием, например `WHERE status = «open»`, для каскада `ON DELETE` не используется). Покрыто 22 из 33. Для остальных в проектной схеме добавляются индексы (ARCHITECTURE.md, раздел 5.6).

| FK | → | ON DELETE | Индекс сейчас | Проектное решение |
|---|---|---|---|---|
| `user_settings.user_id` | `users.id` | CASCADE | ✅ `PK` | — |
| `messages_raw.user_id` | `users.id` | CASCADE | ✅ `messages_raw_user_received_idx` | — |
| `batches.user_id` | `users.id` | CASCADE | ✅ `batches_user_opened_idx` | — |
| `items.user_id` | `users.id` | CASCADE | ✅ `items_user_status_priority_idx` | — |
| `items.source_batch_id` | `batches.id` | SET NULL | ✅ `items_source_batch_idx` | — |
| `items.topic_id` | `topics.id` | SET NULL | ❌ нет | `items_topic_id_idx` (приоритет 1) |
| `topics.user_id` | `users.id` | CASCADE | ✅ `topics_user_name_uq` | — |
| `item_revisions.item_id` | `items.id` | CASCADE | ✅ `item_revisions_item_created_idx` | — |
| `item_revisions.user_id` | `users.id` | CASCADE | ✅ `item_revisions_user_idx` | — |
| `item_revisions.source_message_id` | `messages_raw.id` | SET NULL | ❌ нет | `item_revisions_source_message_id_idx` (приоритет 1) |
| `pending_questions.user_id` | `users.id` | CASCADE | ❌ нет (есть только частичный `pending_questions_open_uq` — для FK не подходит) | `pending_questions_user_id_idx` (приоритет 2) |
| `pending_questions.item_id` | `items.id` | CASCADE | ❌ нет | `pending_questions_item_id_idx` (приоритет 2) |
| `pending_questions.batch_id` | `batches.id` | CASCADE | ❌ нет | `pending_questions_batch_id_idx` (приоритет 2) |
| `recurrence_suggestions.user_id` | `users.id` | CASCADE | ✅ `recurrence_suggestions_user_created_idx` | — |
| `recurrence_suggestions.item_id` | `items.id` | CASCADE | ❌ нет | `recurrence_suggestions_item_id_idx` (приоритет 2) |
| `project_steps.item_id` | `items.id` | CASCADE | ✅ `project_steps_item_position_uq` | — |
| `project_steps.user_id` | `users.id` | CASCADE | ✅ `project_steps_user_idx` | — |
| `reminders.user_id` | `users.id` | CASCADE | ✅ `reminders_user_key_uq` | — |
| `reminders.item_id` | `items.id` | CASCADE | ❌ нет | `reminders_item_id_idx` (приоритет 1) |
| `billing_invoices.user_id` | `users.id` | SET NULL | ✅ `billing_invoices_user_idx` | — |
| `billing_invoices.promo_code` | `promo_codes.code` | SET NULL | ✅ `billing_invoices_promo_idx` | — |
| `billing_subscriptions.user_id` | `users.id` | CASCADE | ✅ `billing_subscriptions_one_idx` | — |
| `billing_events.invoice_id` | `billing_invoices.id` | SET NULL | ❌ нет | `billing_events_invoice_id_idx` (приоритет 3) |
| `billing_consents.user_id` | `users.id` | SET NULL | ✅ `billing_consents_user_idx` | — |
| `billing_consents.invoice_id` | `billing_invoices.id` | SET NULL | ❌ нет | `billing_consents_invoice_id_idx` (приоритет 3) |
| `ai_calls.user_id` | `users.id` | SET NULL | ✅ `ai_calls_user_created_idx` | — |
| `ai_calls.batch_id` | `batches.id` | SET NULL | ✅ `ai_calls_batch_idx` | — |
| `document_versions.slug` | `documents.slug` | CASCADE | ✅ `document_versions_slug_idx` | — |
| `misunderstood.user_id` | `users.id` | CASCADE | ✅ `misunderstood_user_idx` | — |
| `misunderstood.batch_id` | `batches.id` | SET NULL | ❌ нет | `misunderstood_batch_id_idx` (приоритет 2) |
| `admin_access_log.subject_user_id` | `users.id` | SET NULL | ✅ `admin_access_subject_idx` | — |
| `broadcast_deliveries.broadcast_id` | `broadcasts.id` | CASCADE | ✅ `broadcast_once_idx` | — |
| `broadcast_deliveries.user_id` | `users.id` | CASCADE | ❌ нет | `broadcast_deliveries_user_id_idx` (приоритет 3) |
