-- Fase 2: backend en Supabase.
-- Las tablas no tienen políticas públicas: solo la función `api` (con service role) las lee.
-- Así el navegador nunca recibe los años de las cartas que todavía no ubicó.

create table if not exists events (
  id           text primary key,
  year         int  not null,
  date         text,
  precision    text not null default 'year',
  category     text not null,
  title        text not null,
  description  text not null default '',
  tags         text[] not null default '{}',
  source       text,
  status       text not null default 'approved',
  -- Estadísticas para medir dificultad real
  plays          int not null default 0,
  first_try_hits int not null default 0,
  updated_at   timestamptz not null default now()
);

create table if not exists puzzles (
  date    date primary key,
  number  int  not null,
  ids     text[] not null
);

create table if not exists plays (
  id         bigserial primary key,
  date       date not null,
  anon_id    text not null,
  score      int  not null check (score between 0 and 36),
  misses     int[] not null,
  created_at timestamptz not null default now(),
  unique (date, anon_id)
);

create index if not exists plays_date_idx on plays (date);

alter table events  enable row level security;
alter table puzzles enable row level security;
alter table plays   enable row level security;

-- Dificultad: porcentaje de jugadores que la ubicaron al primer intento
create or replace view event_difficulty as
  select id, title, year, plays, first_try_hits,
         case when plays = 0 then null else round(100.0 * first_try_hits / plays, 1) end as first_try_pct
  from events;

-- Suma estadísticas de una partida terminada (llamada desde la función `api`)
create or replace function record_play(p_ids text[], p_misses int[]) returns void
language sql security definer as $$
  update events e
     set plays = plays + 1,
         first_try_hits = first_try_hits + case when p_misses[x.ord - 1] = 0 then 1 else 0 end
    from unnest(p_ids) with ordinality as x(id, ord)
   where e.id = x.id and x.ord > 1;  -- la carta de inicio (ord = 1) no se juega
$$;

-- Estadísticas del día para un puntaje
create or replace function day_stats(p_date date, p_score int)
returns table (players bigint, average numeric, percentile numeric)
language sql stable security definer as $$
  select count(*)::bigint,
         coalesce(round(avg(score)::numeric, 2), 0),
         coalesce(round(100.0 * count(*) filter (where score < p_score) / nullif(count(*), 0), 1), 0)
    from plays where date = p_date;
$$;
