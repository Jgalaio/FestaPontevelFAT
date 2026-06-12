create extension if not exists pgcrypto;

create table if not exists public.anotacoes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  texto text not null,
  criado_por_id uuid references public.utilizadores(id) on delete set null,
  criado_por_nome text not null,
  atualizado_por_id uuid references public.utilizadores(id) on delete set null,
  atualizado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.anotacoes
  add column if not exists titulo text not null default '',
  add column if not exists texto text not null default '',
  add column if not exists criado_por_id uuid references public.utilizadores(id) on delete set null,
  add column if not exists criado_por_nome text not null default 'Sistema',
  add column if not exists atualizado_por_id uuid references public.utilizadores(id) on delete set null,
  add column if not exists atualizado_por_nome text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_anotacoes_updated
  on public.anotacoes (updated_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_anotacoes_updated_at on public.anotacoes;

create trigger set_anotacoes_updated_at
before update on public.anotacoes
for each row
execute function public.set_updated_at();

create or replace function public.app_listar_anotacoes(p_token text)
returns setof public.anotacoes
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
  from public.anotacoes
  order by updated_at desc, created_at desc;
end;
$$;

create or replace function public.app_guardar_anotacao(
  p_token text,
  p_id uuid default null,
  p_titulo text default '',
  p_texto text default ''
)
returns setof public.anotacoes
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
  saved_id uuid;
  normalized_titulo text;
  normalized_texto text;
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  normalized_titulo := regexp_replace(trim(coalesce(p_titulo, '')), '[[:space:]]+', ' ', 'g');
  normalized_texto := trim(coalesce(p_texto, ''));

  if normalized_titulo = '' then
    raise exception 'Indica o título da anotação' using errcode = '22023';
  end if;

  if normalized_texto = '' then
    raise exception 'Escreve a anotação' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.anotacoes (
      titulo,
      texto,
      criado_por_id,
      criado_por_nome
    )
    values (
      normalized_titulo,
      normalized_texto,
      actor.utilizador_id,
      actor.nome
    )
    returning id into saved_id;
  else
    update public.anotacoes
    set titulo = normalized_titulo,
        texto = normalized_texto,
        atualizado_por_id = actor.utilizador_id,
        atualizado_por_nome = actor.nome,
        updated_at = now()
    where id = p_id
    returning id into saved_id;
  end if;

  if saved_id is null then
    raise exception 'Anotação não encontrada' using errcode = '02000';
  end if;

  return query
  select *
  from public.anotacoes
  where id = saved_id;
end;
$$;

create or replace function public.app_apagar_anotacao(
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

  delete from public.anotacoes
  where id = p_id;
end;
$$;

alter table public.anotacoes enable row level security;

grant execute on all functions in schema public to anon, authenticated;
