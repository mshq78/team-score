/**
 * Postgres-backed store (Neon on Vercel). Driver-agnostic: it only needs a
 * function that runs one parameterized statement and returns rows, so the
 * same SQL runs through @neondatabase/serverless in production and through
 * `pg` against a local Postgres in tests.
 */
import crypto from 'node:crypto';
import type { AppState } from '../src/store/state';
import type { Judge } from '../src/types';
import { LOGIN_BLOCK_MS, LOGIN_MAX_FAILURES, type Store, type StoredState } from './core.js';

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
  `create table if not exists teamkeshi_login_failures (
     ip text primary key,
     count int not null,
     until timestamptz not null
   )`,
];

export function createPostgresStore(exec: SqlExecutor): Store {
  let ready: Promise<void> | null = null;
  const init = () => {
    if (!ready) {
      ready = (async () => {
        for (const statement of SCHEMA) await exec(statement);
        await exec(
          `insert into teamkeshi_meta (key, value) values ('instance_id', $1) on conflict (key) do nothing`,
          [crypto.randomBytes(8).toString('hex')]
        );
      })().catch((e) => {
        ready = null;
        throw e;
      });
    }
    return ready;
  };

  return {
    async getRev() {
      await init();
      const rows = await exec(`select rev from teamkeshi_state where id = 1`);
      return rows.length ? Number(rows[0].rev) : null;
    },

    async load(): Promise<StoredState | null> {
      await init();
      const rows = await exec(`select rev, state from teamkeshi_state where id = 1`);
      if (!rows.length) return null;
      return { rev: Number(rows[0].rev), state: rows[0].state as AppState };
    },

    async loadJudges() {
      await init();
      const rows = await exec(
        `select rev, coalesce(state->'scoring'->'judges', '[]'::jsonb) as judges from teamkeshi_state where id = 1`
      );
      if (!rows.length) return null;
      return { rev: Number(rows[0].rev), judges: (rows[0].judges as Judge[]) || [] };
    },

    async compareAndSwap(expectedRev: number, state: AppState) {
      await init();
      const json = JSON.stringify(state);
      const rows = expectedRev === 0
        ? await exec(
            `insert into teamkeshi_state (id, rev, state) values (1, 1, $1::jsonb)
             on conflict (id) do nothing returning rev`,
            [json]
          )
        : await exec(
            `update teamkeshi_state set rev = rev + 1, state = $1::jsonb, updated_at = now()
             where id = 1 and rev = $2 returning rev`,
            [json, expectedRev]
          );
      if (!rows.length) return null;
      const rev = Number(rows[0].rev);

      if (rev === 1 || rev % BACKUP_EVERY_REVS === 0) {
        try {
          await exec(`insert into teamkeshi_backups (rev, state) values ($1, $2::jsonb)`, [rev, json]);
          await exec(
            `delete from teamkeshi_backups where id <= (select max(id) - $1 from teamkeshi_backups)`,
            [BACKUPS_TO_KEEP]
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
  };
}
