/**
 * Postgres-backed store (Neon on Vercel). Driver-agnostic: it only needs a
 * function that runs one parameterized statement and returns rows, so the
 * same SQL runs through @neondatabase/serverless in production and through
 * `pg` against a local Postgres in tests.
 */
import crypto from 'node:crypto';
import type { AppState } from '../src/store/state';
import type { Judge } from '../src/types';
import {
  DEFAULT_EVENT_ID,
  DEFAULT_EVENT_NAME,
  LOGIN_BLOCK_MS,
  LOGIN_MAX_FAILURES,
  type EventMeta,
  type EventStore,
  type Store,
  type StoredState,
} from './core.js';

export type SqlExecutor = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

const BACKUP_EVERY_REVS = 25;
const BACKUPS_TO_KEEP = 200;

const SCHEMA = [
  `create table if not exists teamkeshi_state (
     id int primary key default 1 check (id = 1),
     rev int not null,
     state jsonb not null,
     updated_at timestamptz not null default now()
   )`,
  `create table if not exists teamkeshi_meta (
     key text primary key,
     value text not null
   )`,
  `create table if not exists teamkeshi_backups (
     id bigserial primary key,
     rev int not null,
     state jsonb not null,
     created_at timestamptz not null default now()
   )`,
  `create table if not exists teamkeshi_events (
     event_id text primary key,
     name text not null,
     created_at timestamptz not null default now()
   )`,
  `create table if not exists teamkeshi_event_state (
     event_id text primary key,
     rev int not null,
     state jsonb not null,
     updated_at timestamptz not null default now()
   )`,
  `alter table teamkeshi_backups add column if not exists event_id text not null default 'default'`,
  `create table if not exists teamkeshi_login_failures (
     ip text primary key,
     count int not null,
     until timestamptz not null
   )`,
];

export function createPostgresStore(exec: SqlExecutor): EventStore {
  let ready: Promise<void> | null = null;
  const init = () => {
    if (!ready) {
      ready = (async () => {
        for (const statement of SCHEMA) await exec(statement);
        await exec(
          `insert into teamkeshi_meta (key, value) values ('instance_id', $1) on conflict (key) do nothing`,
          [crypto.randomBytes(8).toString('hex')]
        );
        await exec(
          `insert into teamkeshi_events (event_id, name) values ($1, $2) on conflict (event_id) do nothing`,
          [DEFAULT_EVENT_ID, DEFAULT_EVENT_NAME]
        );
        // Data from before events existed lives in the single-row table: adopt it as the default event
        await exec(
          `insert into teamkeshi_event_state (event_id, rev, state, updated_at)
           select $1, rev, state, updated_at from teamkeshi_state where id = 1
           on conflict (event_id) do nothing`,
          [DEFAULT_EVENT_ID]
        );
      })().catch((e) => {
        ready = null;
        throw e;
      });
    }
    return ready;
  };

  const scoped = (eventId: string): Store => ({
    async getRev() {
      await init();
      const rows = await exec(`select rev from teamkeshi_event_state where event_id = $1`, [eventId]);
      return rows.length ? Number(rows[0].rev) : null;
    },

    async load(): Promise<StoredState | null> {
      await init();
      const rows = await exec(`select rev, state from teamkeshi_event_state where event_id = $1`, [eventId]);
      if (!rows.length) return null;
      return { rev: Number(rows[0].rev), state: rows[0].state as AppState };
    },

    async loadJudges() {
      await init();
      const rows = await exec(
        `select rev, coalesce(state->'scoring'->'judges', '[]'::jsonb) as judges
         from teamkeshi_event_state where event_id = $1`,
        [eventId]
      );
      if (!rows.length) return null;
      return { rev: Number(rows[0].rev), judges: (rows[0].judges as Judge[]) || [] };
    },

    async compareAndSwap(expectedRev: number, state: AppState) {
      await init();
      const json = JSON.stringify(state);
      const rows = expectedRev === 0
        ? await exec(
            `insert into teamkeshi_event_state (event_id, rev, state) values ($2, 1, $1::jsonb)
             on conflict (event_id) do nothing returning rev`,
            [json, eventId]
          )
        : await exec(
            `update teamkeshi_event_state set rev = rev + 1, state = $1::jsonb, updated_at = now()
             where event_id = $3 and rev = $2 returning rev`,
            [json, expectedRev, eventId]
          );
      if (!rows.length) return null;
      const rev = Number(rows[0].rev);

      if (rev === 1 || rev % BACKUP_EVERY_REVS === 0) {
        try {
          await exec(`insert into teamkeshi_backups (rev, state, event_id) values ($1, $2::jsonb, $3)`, [rev, json, eventId]);
          await exec(
            `delete from teamkeshi_backups
             where event_id = $2 and id <= (select max(id) - $1 from teamkeshi_backups where event_id = $2)`,
            [BACKUPS_TO_KEEP, eventId]
          );
        } catch {
          // a failed backup must never fail the write itself
        }
      }
      return rev;
    },

    async instanceId() {
      await init();
      const rows = await exec(`select value from teamkeshi_meta where key = 'instance_id'`);
      return String(rows[0]?.value ?? '');
    },

    async isLoginBlocked(ip: string) {
      await init();
      const rows = await exec(
        `select 1 from teamkeshi_login_failures where ip = $1 and count >= $2 and until > now()`,
        [ip, LOGIN_MAX_FAILURES]
      );
      return rows.length > 0;
    },

    async recordLoginFailure(ip: string) {
      await init();
      const window = `${Math.round(LOGIN_BLOCK_MS / 1000)} seconds`;
      await exec(
        `insert into teamkeshi_login_failures as f (ip, count, until)
         values ($1, 1, now() + $2::interval)
         on conflict (ip) do update set
           count = case when f.until < now() then 1 else f.count + 1 end,
           until = case when f.until < now() then now() + $2::interval else f.until end`,
        [ip, window]
      );
    },

    async clearLoginFailures(ip: string) {
      await init();
      await exec(`delete from teamkeshi_login_failures where ip = $1`, [ip]);
    },
  });

  const toMeta = (r: Record<string, unknown>): EventMeta => ({
    id: String(r.event_id),
    name: String(r.name),
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ''),
  });

  return {
    ...scoped(DEFAULT_EVENT_ID),
    forEvent: scoped,
    async eventExists(eventId: string) {
      await init();
      return (await exec(`select 1 from teamkeshi_events where event_id = $1`, [eventId])).length > 0;
    },
    async listEvents() {
      await init();
      const rows = await exec(`select event_id, name, created_at from teamkeshi_events order by created_at, event_id`);
      return rows.map(toMeta);
    },
    async createEvent(name: string) {
      await init();
      const rows = await exec(
        `insert into teamkeshi_events (event_id, name) values ($1, $2) returning event_id, name, created_at`,
        [crypto.randomBytes(4).toString('hex'), name]
      );
      return toMeta(rows[0]);
    },
    async renameEvent(eventId: string, name: string) {
      await init();
      const rows = await exec(
        `update teamkeshi_events set name = $2 where event_id = $1 returning event_id, name, created_at`,
        [eventId, name]
      );
      return rows.length ? toMeta(rows[0]) : null;
    },
  };
}
