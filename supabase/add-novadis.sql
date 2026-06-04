create table if not exists public.novadis_config (
  id boolean primary key default true,
  imperial_valor_unitario numeric not null default 0,
  imperial_valor_tara numeric not null default 0,
  cidra_valor_unitario numeric not null default 0,
  cidra_valor_tara numeric not null default 0,
  sangria_valor_unitario numeric not null default 0,
  sangria_valor_tara numeric not null default 0,
  co2_valor_unitario numeric not null default 0,
  co2_valor_tara numeric not null default 0,
  atualizado_por_id uuid references public.utilizadores(id) on delete set null,
  atualizado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint novadis_config_singleton check (id)
);

alter table public.novadis_config
  add column if not exists imperial_valor_unitario numeric not null default 0,
  add column if not exists imperial_valor_tara numeric not null default 0,
  add column if not exists cidra_valor_unitario numeric not null default 0,
  add column if not exists cidra_valor_tara numeric not null default 0,
  add column if not exists sangria_valor_unitario numeric not null default 0,
  add column if not exists sangria_valor_tara numeric not null default 0,
  add column if not exists co2_valor_unitario numeric not null default 0,
  add column if not exists co2_valor_tara numeric not null default 0,
  add column if not exists atualizado_por_id uuid references public.utilizadores(id) on delete set null,
  add column if not exists atualizado_por_nome text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.novadis_barris (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'imperial',
  quantidade integer not null check (quantidade > 0),
  criado_por_id uuid references public.utilizadores(id) on delete set null,
  criado_por_nome text not null,
  created_at timestamptz not null default now(),
  constraint novadis_barris_tipo_check check (tipo in ('imperial', 'cidra', 'sangria', 'co2'))
);

alter table public.novadis_barris
  add column if not exists tipo text not null default 'imperial';

create table if not exists public.novadis_consumos (
  id uuid primary key default gen_random_uuid(),
  data date not null references public.dias_festa(data) on delete restrict,
  tipo text not null default 'imperial',
  quantidade integer not null check (quantidade > 0),
  criado_por_id uuid references public.utilizadores(id) on delete set null,
  criado_por_nome text not null,
  created_at timestamptz not null default now(),
  constraint novadis_consumos_tipo_check check (tipo in ('imperial', 'cidra', 'sangria', 'co2'))
);

alter table public.novadis_consumos
  add column if not exists data date,
  add column if not exists tipo text not null default 'imperial',
  add column if not exists quantidade integer not null default 1,
  add column if not exists criado_por_id uuid references public.utilizadores(id) on delete set null,
  add column if not exists criado_por_nome text not null default 'Sistema',
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'novadis_barris_tipo_check'
      and conrelid = 'public.novadis_barris'::regclass
  ) then
    alter table public.novadis_barris
      add constraint novadis_barris_tipo_check check (tipo in ('imperial', 'cidra', 'sangria', 'co2'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'novadis_consumos_tipo_check'
      and conrelid = 'public.novadis_consumos'::regclass
  ) then
    alter table public.novadis_consumos
      add constraint novadis_consumos_tipo_check check (tipo in ('imperial', 'cidra', 'sangria', 'co2'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'novadis_consumos_quantidade_check'
      and conrelid = 'public.novadis_consumos'::regclass
  ) then
    alter table public.novadis_consumos
      add constraint novadis_consumos_quantidade_check check (quantidade > 0);
  end if;
end;
$$;

insert into public.novadis_config (id)
values (true)
on conflict (id) do nothing;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'novadis_config'
      and column_name = 'valor_barril'
  ) then
    execute '
      update public.novadis_config
      set imperial_valor_unitario = valor_barril
      where imperial_valor_unitario = 0
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'novadis_config'
      and column_name = 'valor_tara'
  ) then
    execute '
      update public.novadis_config
      set imperial_valor_tara = valor_tara
      where imperial_valor_tara = 0
    ';
  end if;
end;
$$;

create index if not exists idx_novadis_barris_created
  on public.novadis_barris (created_at desc);

create index if not exists idx_novadis_barris_tipo
  on public.novadis_barris (tipo);

create index if not exists idx_novadis_consumos_data
  on public.novadis_consumos (data desc);

create index if not exists idx_novadis_consumos_tipo
  on public.novadis_consumos (tipo);

alter table public.novadis_config enable row level security;
alter table public.novadis_barris enable row level security;
alter table public.novadis_consumos enable row level security;

drop function if exists public.app_guardar_novadis_config(text, numeric, numeric);
drop function if exists public.app_registar_novadis_barris(text, integer);

create or replace function public.app_obter_novadis_config(p_token text)
returns setof public.novadis_config
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  return query
  select *
  from public.novadis_config
  where id = true
  limit 1;
end;
$$;

create or replace function public.app_guardar_novadis_config(
  p_token text,
  p_imperial_valor_unitario numeric default 0,
  p_imperial_valor_tara numeric default 0,
  p_cidra_valor_unitario numeric default 0,
  p_cidra_valor_tara numeric default 0,
  p_sangria_valor_unitario numeric default 0,
  p_sangria_valor_tara numeric default 0,
  p_co2_valor_unitario numeric default 0,
  p_co2_valor_tara numeric default 0
)
returns setof public.novadis_config
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  if actor.role <> 'admin' then
    raise exception 'Não tem privilégios para alterar valores da Novadis' using errcode = '42501';
  end if;

  if coalesce(p_imperial_valor_unitario, 0) < 0
    or coalesce(p_imperial_valor_tara, 0) < 0
    or coalesce(p_cidra_valor_unitario, 0) < 0
    or coalesce(p_cidra_valor_tara, 0) < 0
    or coalesce(p_sangria_valor_unitario, 0) < 0
    or coalesce(p_sangria_valor_tara, 0) < 0
    or coalesce(p_co2_valor_unitario, 0) < 0
    or coalesce(p_co2_valor_tara, 0) < 0 then
    raise exception 'Os valores da Novadis não podem ser negativos' using errcode = '22023';
  end if;

  insert into public.novadis_config (
    id,
    imperial_valor_unitario,
    imperial_valor_tara,
    cidra_valor_unitario,
    cidra_valor_tara,
    sangria_valor_unitario,
    sangria_valor_tara,
    co2_valor_unitario,
    co2_valor_tara,
    atualizado_por_id,
    atualizado_por_nome,
    updated_at
  )
  values (
    true,
    coalesce(p_imperial_valor_unitario, 0),
    coalesce(p_imperial_valor_tara, 0),
    coalesce(p_cidra_valor_unitario, 0),
    coalesce(p_cidra_valor_tara, 0),
    coalesce(p_sangria_valor_unitario, 0),
    coalesce(p_sangria_valor_tara, 0),
    coalesce(p_co2_valor_unitario, 0),
    coalesce(p_co2_valor_tara, 0),
    actor.utilizador_id,
    actor.nome,
    now()
  )
  on conflict (id) do update
  set imperial_valor_unitario = excluded.imperial_valor_unitario,
      imperial_valor_tara = excluded.imperial_valor_tara,
      cidra_valor_unitario = excluded.cidra_valor_unitario,
      cidra_valor_tara = excluded.cidra_valor_tara,
      sangria_valor_unitario = excluded.sangria_valor_unitario,
      sangria_valor_tara = excluded.sangria_valor_tara,
      co2_valor_unitario = excluded.co2_valor_unitario,
      co2_valor_tara = excluded.co2_valor_tara,
      atualizado_por_id = excluded.atualizado_por_id,
      atualizado_por_nome = excluded.atualizado_por_nome,
      updated_at = now();

  return query
  select *
  from public.novadis_config
  where id = true
  limit 1;
end;
$$;

create or replace function public.app_listar_novadis_barris(p_token text)
returns setof public.novadis_barris
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  return query
  select *
  from public.novadis_barris
  order by created_at desc;
end;
$$;

create or replace function public.app_registar_novadis_barris(
  p_token text,
  p_tipo text,
  p_quantidade integer
)
returns setof public.novadis_barris
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
  saved_id uuid;
  normalized_tipo text;
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  normalized_tipo := coalesce(nullif(trim(p_tipo), ''), 'imperial');

  if normalized_tipo not in ('imperial', 'cidra', 'sangria', 'co2') then
    raise exception 'Escolhe um tipo de registo Novadis válido' using errcode = '22023';
  end if;

  if coalesce(p_quantidade, 0) <= 0 then
    raise exception 'Indica uma quantidade maior que zero' using errcode = '22023';
  end if;

  insert into public.novadis_barris (
    tipo,
    quantidade,
    criado_por_id,
    criado_por_nome
  )
  values (
    normalized_tipo,
    p_quantidade,
    actor.utilizador_id,
    actor.nome
  )
  returning id into saved_id;

  return query
  select *
  from public.novadis_barris
  where id = saved_id;
end;
$$;

create or replace function public.app_listar_novadis_consumos(p_token text)
returns setof public.novadis_consumos
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  return query
  select *
  from public.novadis_consumos
  order by data desc, created_at desc;
end;
$$;

create or replace function public.app_registar_novadis_consumo(
  p_token text,
  p_data date,
  p_tipo text,
  p_quantidade integer
)
returns setof public.novadis_consumos
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
  saved_id uuid;
  normalized_tipo text;
  total_recebido integer;
  total_consumido integer;
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  perform public.app_require_dia_aberto(p_data);

  normalized_tipo := coalesce(nullif(trim(p_tipo), ''), 'imperial');

  if normalized_tipo not in ('imperial', 'cidra', 'sangria', 'co2') then
    raise exception 'Escolhe um tipo de registo Novadis válido' using errcode = '22023';
  end if;

  if coalesce(p_quantidade, 0) <= 0 then
    raise exception 'Indica uma quantidade maior que zero' using errcode = '22023';
  end if;

  select coalesce(sum(quantidade), 0)
  into total_recebido
  from public.novadis_barris
  where tipo = normalized_tipo;

  select coalesce(sum(quantidade), 0)
  into total_consumido
  from public.novadis_consumos
  where tipo = normalized_tipo;

  if total_consumido + p_quantidade > total_recebido then
    raise exception 'Não existem unidades Novadis suficientes disponíveis para esse gasto' using errcode = '22023';
  end if;

  insert into public.novadis_consumos (
    data,
    tipo,
    quantidade,
    criado_por_id,
    criado_por_nome
  )
  values (
    p_data,
    normalized_tipo,
    p_quantidade,
    actor.utilizador_id,
    actor.nome
  )
  returning id into saved_id;

  return query
  select *
  from public.novadis_consumos
  where id = saved_id;
end;
$$;
