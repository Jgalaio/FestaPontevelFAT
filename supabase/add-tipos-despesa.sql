create extension if not exists pgcrypto;

create table if not exists public.tipos_despesa (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  criado_por_id uuid references public.utilizadores(id) on delete set null,
  criado_por_nome text,
  atualizado_por_id uuid references public.utilizadores(id) on delete set null,
  atualizado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists tipos_despesa_nome_lower_key
  on public.tipos_despesa (lower(nome));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_tipos_despesa_updated_at on public.tipos_despesa;

create trigger set_tipos_despesa_updated_at
before update on public.tipos_despesa
for each row
execute function public.set_updated_at();

create or replace function public.app_listar_tipos_despesa(p_token text)
returns setof public.tipos_despesa
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
  from public.tipos_despesa
  order by ativo desc, nome asc;
end;
$$;

create or replace function public.app_guardar_tipo_despesa(
  p_token text,
  p_id uuid default null,
  p_nome text default null,
  p_ativo boolean default true
)
returns setof public.tipos_despesa
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
  saved_id uuid;
  normalized_nome text := trim(coalesce(p_nome, ''));
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  if normalized_nome = '' then
    raise exception 'Indica o nome do tipo de despesa' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.tipos_despesa t
    where lower(t.nome) = lower(normalized_nome)
      and (p_id is null or t.id <> p_id)
  ) then
    raise exception 'Esse tipo de despesa já existe' using errcode = '23505';
  end if;

  if p_id is null then
    insert into public.tipos_despesa (
      nome,
      ativo,
      criado_por_id,
      criado_por_nome,
      atualizado_por_id,
      atualizado_por_nome
    )
    values (
      normalized_nome,
      coalesce(p_ativo, true),
      actor.utilizador_id,
      actor.nome,
      actor.utilizador_id,
      actor.nome
    )
    returning tipos_despesa.id into saved_id;
  else
    update public.tipos_despesa
    set nome = normalized_nome,
        ativo = coalesce(p_ativo, true),
        atualizado_por_id = actor.utilizador_id,
        atualizado_por_nome = actor.nome,
        updated_at = now()
    where tipos_despesa.id = p_id
    returning tipos_despesa.id into saved_id;
  end if;

  if saved_id is null then
    raise exception 'Tipo de despesa não encontrado' using errcode = '02000';
  end if;

  return query
  select *
  from public.tipos_despesa
  where id = saved_id;
end;
$$;

insert into public.tipos_despesa (nome, ativo, criado_por_nome, atualizado_por_nome)
values
  ('Produtos', true, 'Sistema', 'Sistema'),
  ('Serviços', true, 'Sistema', 'Sistema'),
  ('Equipamento', true, 'Sistema', 'Sistema'),
  ('Licenças', true, 'Sistema', 'Sistema'),
  ('Segurança', true, 'Sistema', 'Sistema'),
  ('Música', true, 'Sistema', 'Sistema'),
  ('Limpeza', true, 'Sistema', 'Sistema'),
  ('Outros', true, 'Sistema', 'Sistema')
on conflict do nothing;

alter table public.tipos_despesa enable row level security;

drop policy if exists "Equipa autenticada pode ler tipos despesa" on public.tipos_despesa;
drop policy if exists "Equipa autenticada pode criar tipos despesa" on public.tipos_despesa;
drop policy if exists "Equipa autenticada pode editar tipos despesa" on public.tipos_despesa;
drop policy if exists "Equipa autenticada pode apagar tipos despesa" on public.tipos_despesa;

grant execute on all functions in schema public to anon, authenticated;
