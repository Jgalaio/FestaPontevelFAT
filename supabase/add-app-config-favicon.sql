create table if not exists public.app_config (
  id boolean primary key default true,
  favicon_data_url text,
  atualizado_por_id uuid references public.utilizadores(id) on delete set null,
  atualizado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_config_singleton check (id)
);

alter table public.app_config
  add column if not exists favicon_data_url text,
  add column if not exists atualizado_por_id uuid references public.utilizadores(id) on delete set null,
  add column if not exists atualizado_por_nome text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

insert into public.app_config (id)
values (true)
on conflict (id) do nothing;

alter table public.app_config enable row level security;

create or replace function public.app_obter_config_publica()
returns setof public.app_config
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  select *
  from public.app_config
  where id = true
  limit 1;
end;
$$;

create or replace function public.app_guardar_favicon(
  p_token text,
  p_favicon_data_url text default null
)
returns setof public.app_config
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
  normalized_favicon text := nullif(trim(coalesce(p_favicon_data_url, '')), '');
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  if actor.role <> 'admin' then
    raise exception 'Apenas administradores podem alterar o favicon' using errcode = '42501';
  end if;

  if normalized_favicon is not null and normalized_favicon not like 'data:image/%' then
    raise exception 'O favicon deve ser uma imagem válida' using errcode = '22023';
  end if;

  if normalized_favicon is not null and length(normalized_favicon) > 1000000 then
    raise exception 'O favicon deve ter no máximo 1 MB depois de preparado' using errcode = '22023';
  end if;

  insert into public.app_config (
    id,
    favicon_data_url,
    atualizado_por_id,
    atualizado_por_nome,
    updated_at
  )
  values (
    true,
    normalized_favicon,
    actor.utilizador_id,
    actor.nome,
    now()
  )
  on conflict (id) do update
  set favicon_data_url = excluded.favicon_data_url,
      atualizado_por_id = excluded.atualizado_por_id,
      atualizado_por_nome = excluded.atualizado_por_nome,
      updated_at = now();

  return query
  select *
  from public.app_config
  where id = true
  limit 1;
end;
$$;

grant execute on function public.app_obter_config_publica() to anon, authenticated;
grant execute on function public.app_guardar_favicon(text, text) to anon, authenticated;
