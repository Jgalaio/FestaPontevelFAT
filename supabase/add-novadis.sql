create table if not exists public.novadis_config (
  id boolean primary key default true,
  valor_barril numeric not null default 0,
  valor_tara numeric not null default 0,
  atualizado_por_id uuid references public.utilizadores(id) on delete set null,
  atualizado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint novadis_config_singleton check (id)
);

create table if not exists public.novadis_barris (
  id uuid primary key default gen_random_uuid(),
  quantidade integer not null check (quantidade > 0),
  criado_por_id uuid references public.utilizadores(id) on delete set null,
  criado_por_nome text not null,
  created_at timestamptz not null default now()
);

insert into public.novadis_config (id)
values (true)
on conflict (id) do nothing;

create index if not exists idx_novadis_barris_created
  on public.novadis_barris (created_at desc);

alter table public.novadis_config enable row level security;
alter table public.novadis_barris enable row level security;

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
  p_valor_barril numeric default 0,
  p_valor_tara numeric default 0
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

  if coalesce(p_valor_barril, 0) < 0 or coalesce(p_valor_tara, 0) < 0 then
    raise exception 'Os valores da Novadis não podem ser negativos' using errcode = '22023';
  end if;

  insert into public.novadis_config (
    id,
    valor_barril,
    valor_tara,
    atualizado_por_id,
    atualizado_por_nome,
    updated_at
  )
  values (
    true,
    coalesce(p_valor_barril, 0),
    coalesce(p_valor_tara, 0),
    actor.utilizador_id,
    actor.nome,
    now()
  )
  on conflict (id) do update
  set valor_barril = excluded.valor_barril,
      valor_tara = excluded.valor_tara,
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
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  if coalesce(p_quantidade, 0) <= 0 then
    raise exception 'Indica uma quantidade de barris maior que zero' using errcode = '22023';
  end if;

  insert into public.novadis_barris (
    quantidade,
    criado_por_id,
    criado_por_nome
  )
  values (
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
