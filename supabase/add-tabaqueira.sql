create table if not exists public.tabaqueira_entradas (
  id uuid primary key default gen_random_uuid(),
  marca text not null,
  quantidade integer not null check (quantidade > 0),
  preco_fornecedor numeric not null default 0 check (preco_fornecedor >= 0),
  pvp numeric not null default 0 check (pvp >= 0),
  criado_por_id uuid references public.utilizadores(id) on delete set null,
  criado_por_nome text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.tabaqueira_saidas (
  id uuid primary key default gen_random_uuid(),
  marca text not null,
  quantidade integer not null check (quantidade > 0),
  levado_por text not null,
  posto_id uuid references public.postos(id) on delete set null,
  posto_nome text not null,
  justificacao_edicao text,
  criado_por_id uuid references public.utilizadores(id) on delete set null,
  criado_por_nome text not null,
  atualizado_por_id uuid references public.utilizadores(id) on delete set null,
  atualizado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tabaqueira_entradas
  add column if not exists marca text not null default '',
  add column if not exists quantidade integer not null default 1,
  add column if not exists preco_fornecedor numeric not null default 0,
  add column if not exists pvp numeric not null default 0,
  add column if not exists criado_por_id uuid references public.utilizadores(id) on delete set null,
  add column if not exists criado_por_nome text not null default 'Sistema',
  add column if not exists created_at timestamptz not null default now();

alter table public.tabaqueira_saidas
  add column if not exists marca text not null default '',
  add column if not exists quantidade integer not null default 1,
  add column if not exists levado_por text not null default '',
  add column if not exists posto_id uuid references public.postos(id) on delete set null,
  add column if not exists posto_nome text not null default 'Posto removido',
  add column if not exists justificacao_edicao text,
  add column if not exists criado_por_id uuid references public.utilizadores(id) on delete set null,
  add column if not exists criado_por_nome text not null default 'Sistema',
  add column if not exists atualizado_por_id uuid references public.utilizadores(id) on delete set null,
  add column if not exists atualizado_por_nome text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tabaqueira_entradas_quantidade_check'
      and conrelid = 'public.tabaqueira_entradas'::regclass
  ) then
    alter table public.tabaqueira_entradas
      add constraint tabaqueira_entradas_quantidade_check check (quantidade > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tabaqueira_entradas_preco_fornecedor_check'
      and conrelid = 'public.tabaqueira_entradas'::regclass
  ) then
    alter table public.tabaqueira_entradas
      add constraint tabaqueira_entradas_preco_fornecedor_check check (preco_fornecedor >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tabaqueira_entradas_pvp_check'
      and conrelid = 'public.tabaqueira_entradas'::regclass
  ) then
    alter table public.tabaqueira_entradas
      add constraint tabaqueira_entradas_pvp_check check (pvp >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tabaqueira_saidas_quantidade_check'
      and conrelid = 'public.tabaqueira_saidas'::regclass
  ) then
    alter table public.tabaqueira_saidas
      add constraint tabaqueira_saidas_quantidade_check check (quantidade > 0);
  end if;
end;
$$;

create index if not exists idx_tabaqueira_entradas_created
  on public.tabaqueira_entradas (created_at desc);

create index if not exists idx_tabaqueira_entradas_marca
  on public.tabaqueira_entradas (marca);

create index if not exists idx_tabaqueira_saidas_created
  on public.tabaqueira_saidas (created_at desc);

create index if not exists idx_tabaqueira_saidas_marca
  on public.tabaqueira_saidas (marca);

create index if not exists idx_tabaqueira_saidas_posto
  on public.tabaqueira_saidas (posto_id);

alter table public.tabaqueira_entradas enable row level security;
alter table public.tabaqueira_saidas enable row level security;

create or replace function public.app_listar_tabaqueira_entradas(p_token text)
returns setof public.tabaqueira_entradas
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
  from public.tabaqueira_entradas
  order by created_at desc;
end;
$$;

create or replace function public.app_registar_tabaqueira_entrada(
  p_token text,
  p_marca text,
  p_quantidade integer,
  p_preco_fornecedor numeric default 0,
  p_pvp numeric default 0
)
returns setof public.tabaqueira_entradas
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
  saved_id uuid;
  normalized_marca text;
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  normalized_marca := regexp_replace(trim(coalesce(p_marca, '')), '[[:space:]]+', ' ', 'g');

  if normalized_marca = '' then
    raise exception 'Indica a marca do tabaco' using errcode = '22023';
  end if;

  if coalesce(p_quantidade, 0) <= 0 then
    raise exception 'Indica uma quantidade recebida maior que zero' using errcode = '22023';
  end if;

  if coalesce(p_preco_fornecedor, 0) < 0 or coalesce(p_pvp, 0) < 0 then
    raise exception 'Os preços da Tabaqueira não podem ser negativos' using errcode = '22023';
  end if;

  insert into public.tabaqueira_entradas (
    marca,
    quantidade,
    preco_fornecedor,
    pvp,
    criado_por_id,
    criado_por_nome
  )
  values (
    normalized_marca,
    p_quantidade,
    coalesce(p_preco_fornecedor, 0),
    coalesce(p_pvp, 0),
    actor.utilizador_id,
    actor.nome
  )
  returning id into saved_id;

  return query
  select *
  from public.tabaqueira_entradas
  where id = saved_id;
end;
$$;

create or replace function public.app_listar_tabaqueira_saidas(p_token text)
returns setof public.tabaqueira_saidas
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
  from public.tabaqueira_saidas
  order by created_at desc;
end;
$$;

create or replace function public.app_guardar_tabaqueira_saida(
  p_token text,
  p_id uuid default null,
  p_marca text default '',
  p_quantidade integer default 0,
  p_levado_por text default '',
  p_posto_id uuid default null,
  p_justificacao_edicao text default null
)
returns setof public.tabaqueira_saidas
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
  existing_saida public.tabaqueira_saidas%rowtype;
  normalized_marca text;
  normalized_levado_por text;
  normalized_justificacao text;
  posto_nome_atual text;
  total_recebido integer;
  total_saido integer;
  saved_id uuid;
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  normalized_marca := regexp_replace(trim(coalesce(p_marca, '')), '[[:space:]]+', ' ', 'g');
  normalized_levado_por := regexp_replace(trim(coalesce(p_levado_por, '')), '[[:space:]]+', ' ', 'g');
  normalized_justificacao := nullif(regexp_replace(trim(coalesce(p_justificacao_edicao, '')), '[[:space:]]+', ' ', 'g'), '');

  if normalized_marca = '' then
    raise exception 'Escolhe a marca do tabaco para a saída' using errcode = '22023';
  end if;

  if coalesce(p_quantidade, 0) <= 0 then
    raise exception 'Indica uma quantidade de saída maior que zero' using errcode = '22023';
  end if;

  if normalized_levado_por = '' then
    raise exception 'Indica quem levou o tabaco' using errcode = '22023';
  end if;

  select nome
  into posto_nome_atual
  from public.postos
  where id = p_posto_id
  limit 1;

  if posto_nome_atual is null then
    raise exception 'Escolhe o posto de destino' using errcode = '22023';
  end if;

  if p_id is not null then
    select *
    into existing_saida
    from public.tabaqueira_saidas
    where id = p_id
    limit 1;

    if existing_saida.id is null then
      raise exception 'Saída de tabaco não encontrada' using errcode = '02000';
    end if;

    if normalized_justificacao is null then
      raise exception 'Indica a justificação da alteração antes de guardar' using errcode = '22023';
    end if;
  end if;

  select coalesce(sum(quantidade), 0)
  into total_recebido
  from public.tabaqueira_entradas
  where marca = normalized_marca;

  select coalesce(sum(quantidade), 0)
  into total_saido
  from public.tabaqueira_saidas
  where marca = normalized_marca
    and (p_id is null or id <> p_id);

  if total_saido + p_quantidade > total_recebido then
    raise exception 'Não existem maços/unidades suficientes disponíveis para essa marca' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.tabaqueira_saidas (
      marca,
      quantidade,
      levado_por,
      posto_id,
      posto_nome,
      criado_por_id,
      criado_por_nome
    )
    values (
      normalized_marca,
      p_quantidade,
      normalized_levado_por,
      p_posto_id,
      posto_nome_atual,
      actor.utilizador_id,
      actor.nome
    )
    returning id into saved_id;
  else
    update public.tabaqueira_saidas
    set marca = normalized_marca,
        quantidade = p_quantidade,
        levado_por = normalized_levado_por,
        posto_id = p_posto_id,
        posto_nome = posto_nome_atual,
        justificacao_edicao = normalized_justificacao,
        atualizado_por_id = actor.utilizador_id,
        atualizado_por_nome = actor.nome,
        updated_at = now()
    where id = p_id
    returning id into saved_id;
  end if;

  return query
  select *
  from public.tabaqueira_saidas
  where id = saved_id;
end;
$$;

create or replace function public.app_apagar_tabaqueira_saida(
  p_token text,
  p_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  if actor.role <> 'admin' then
    raise exception 'Não tem privilégios para apagar dados inseridos' using errcode = '42501';
  end if;

  delete from public.tabaqueira_saidas
  where id = p_id;
end;
$$;
