create table if not exists public.agente_config (
  id boolean primary key default true,
  valor_eventos_anual numeric not null default 0,
  valor_patrocinios numeric not null default 0,
  valor_peditorio numeric not null default 0,
  valor_necessario_agente numeric not null default 0,
  atualizado_por_id uuid references public.utilizadores(id) on delete set null,
  atualizado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agente_config_singleton check (id)
);

alter table public.agente_config
  add column if not exists valor_necessario_agente numeric not null default 0;

create table if not exists public.pagamentos_agente (
  id uuid primary key default gen_random_uuid(),
  valor numeric not null check (valor > 0),
  entregue_por_id uuid references public.utilizadores(id) on delete set null,
  entregue_por_nome text not null,
  created_at timestamptz not null default now()
);

insert into public.agente_config (id)
values (true)
on conflict (id) do nothing;

create index if not exists idx_pagamentos_agente_created
  on public.pagamentos_agente (created_at desc);

alter table public.agente_config enable row level security;
alter table public.pagamentos_agente enable row level security;

create or replace function public.app_obter_agente_config(p_token text)
returns setof public.agente_config
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
  from public.agente_config
  where id = true
  limit 1;
end;
$$;

drop function if exists public.app_guardar_agente_config(text, numeric, numeric, numeric);

create or replace function public.app_guardar_agente_config(
  p_token text,
  p_valor_eventos_anual numeric default 0,
  p_valor_patrocinios numeric default 0,
  p_valor_peditorio numeric default 0,
  p_valor_necessario_agente numeric default 0
)
returns setof public.agente_config
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  if coalesce(p_valor_eventos_anual, 0) < 0
    or coalesce(p_valor_patrocinios, 0) < 0
    or coalesce(p_valor_peditorio, 0) < 0
    or coalesce(p_valor_necessario_agente, 0) < 0 then
    raise exception 'Os valores do Pag.Agente não podem ser negativos' using errcode = '22023';
  end if;

  insert into public.agente_config (
    id,
    valor_eventos_anual,
    valor_patrocinios,
    valor_peditorio,
    valor_necessario_agente,
    atualizado_por_id,
    atualizado_por_nome,
    updated_at
  )
  values (
    true,
    coalesce(p_valor_eventos_anual, 0),
    coalesce(p_valor_patrocinios, 0),
    coalesce(p_valor_peditorio, 0),
    coalesce(p_valor_necessario_agente, 0),
    actor.utilizador_id,
    actor.nome,
    now()
  )
  on conflict (id) do update
  set valor_eventos_anual = excluded.valor_eventos_anual,
      valor_patrocinios = excluded.valor_patrocinios,
      valor_peditorio = excluded.valor_peditorio,
      valor_necessario_agente = excluded.valor_necessario_agente,
      atualizado_por_id = excluded.atualizado_por_id,
      atualizado_por_nome = excluded.atualizado_por_nome,
      updated_at = now();

  return query
  select *
  from public.agente_config
  where id = true
  limit 1;
end;
$$;

create or replace function public.app_listar_pagamentos_agente(p_token text)
returns setof public.pagamentos_agente
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
  from public.pagamentos_agente
  order by created_at desc;
end;
$$;

create or replace function public.app_registar_pagamento_agente(
  p_token text,
  p_valor numeric default 0
)
returns setof public.pagamentos_agente
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
  saved_id uuid;
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  if coalesce(p_valor, 0) <= 0 then
    raise exception 'Indica um valor entregue ao agente maior que zero' using errcode = '22023';
  end if;

  insert into public.pagamentos_agente (
    valor,
    entregue_por_id,
    entregue_por_nome
  )
  values (
    p_valor,
    actor.utilizador_id,
    actor.nome
  )
  returning id into saved_id;

  return query
  select *
  from public.pagamentos_agente
  where id = saved_id;
end;
$$;
