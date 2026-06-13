create extension if not exists pgcrypto;

create table if not exists public.orcamento_linhas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  designacao text not null,
  valor numeric not null default 0 check (valor >= 0),
  criado_por_id uuid references public.utilizadores(id) on delete set null,
  criado_por_nome text,
  atualizado_por_id uuid references public.utilizadores(id) on delete set null,
  atualizado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orcamento_linhas
  add column if not exists tipo text not null default '',
  add column if not exists designacao text not null default '',
  add column if not exists valor numeric not null default 0,
  add column if not exists criado_por_id uuid references public.utilizadores(id) on delete set null,
  add column if not exists criado_por_nome text,
  add column if not exists atualizado_por_id uuid references public.utilizadores(id) on delete set null,
  add column if not exists atualizado_por_nome text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orcamento_linhas_valor_check'
      and conrelid = 'public.orcamento_linhas'::regclass
  ) then
    alter table public.orcamento_linhas
      add constraint orcamento_linhas_valor_check check (valor >= 0);
  end if;
end;
$$;

create index if not exists idx_orcamento_linhas_tipo
  on public.orcamento_linhas (lower(tipo), created_at asc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_orcamento_linhas_updated_at on public.orcamento_linhas;

create trigger set_orcamento_linhas_updated_at
before update on public.orcamento_linhas
for each row
execute function public.set_updated_at();

create or replace function public.app_listar_orcamento(p_token text)
returns setof public.orcamento_linhas
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
  from public.orcamento_linhas
  order by tipo asc, created_at asc;
end;
$$;

create or replace function public.app_guardar_orcamento_linha(
  p_token text,
  p_id uuid default null,
  p_tipo text default '',
  p_designacao text default '',
  p_valor numeric default 0
)
returns setof public.orcamento_linhas
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
  saved_id uuid;
  normalized_tipo text;
  normalized_designacao text;
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  normalized_tipo := upper(regexp_replace(trim(coalesce(p_tipo, '')), '[[:space:]]+', ' ', 'g'));
  normalized_designacao := regexp_replace(trim(coalesce(p_designacao, '')), '[[:space:]]+', ' ', 'g');

  if normalized_tipo = '' then
    raise exception 'Indica o tipo ou zona do orçamento' using errcode = '22023';
  end if;

  if normalized_designacao = '' then
    raise exception 'Indica a designação da linha' using errcode = '22023';
  end if;

  if coalesce(p_valor, 0) < 0 then
    raise exception 'O valor do orçamento não pode ser negativo' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.orcamento_linhas (
      tipo,
      designacao,
      valor,
      criado_por_id,
      criado_por_nome,
      atualizado_por_id,
      atualizado_por_nome
    )
    values (
      normalized_tipo,
      normalized_designacao,
      coalesce(p_valor, 0),
      actor.utilizador_id,
      actor.nome,
      actor.utilizador_id,
      actor.nome
    )
    returning id into saved_id;
  else
    update public.orcamento_linhas
    set tipo = normalized_tipo,
        designacao = normalized_designacao,
        valor = coalesce(p_valor, 0),
        atualizado_por_id = actor.utilizador_id,
        atualizado_por_nome = actor.nome,
        updated_at = now()
    where id = p_id
    returning id into saved_id;
  end if;

  if saved_id is null then
    raise exception 'Linha de orçamento não encontrada' using errcode = '02000';
  end if;

  return query
  select *
  from public.orcamento_linhas
  where id = saved_id;
end;
$$;

create or replace function public.app_apagar_orcamento_linha(
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

  delete from public.orcamento_linhas
  where id = p_id;
end;
$$;

alter table public.orcamento_linhas enable row level security;

grant execute on all functions in schema public to anon, authenticated;
