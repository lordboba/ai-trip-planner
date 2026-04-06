import postgres from "postgres";

let sqlInstance: postgres.Sql | null = null;
let initPromise: Promise<void> | null = null;

function getDatabaseUrl() {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_PRISMA_URL,
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim();

    if (value) {
      return value;
    }
  }

  return null;
}

export function hasPostgresConfigured() {
  return Boolean(getDatabaseUrl());
}

function getSql() {
  if (sqlInstance) {
    return sqlInstance;
  }

  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    throw new Error("Postgres is not configured.");
  }

  sqlInstance = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return sqlInstance;
}

export async function getPostgres() {
  const sql = getSql();

  if (!initPromise) {
    initPromise = (async () => {
      await sql`
        create table if not exists schedule_plans (
          id uuid primary key,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          payload jsonb not null
        )
      `;
    })();
  }

  await initPromise;
  return sql;
}
