create extension if not exists pgcrypto;

create table if not exists public.utilizadores (
  id uuid primary key default gen_random_uuid(),
  username text,
  nome text,
  password_hash text,
  ativo boolean not null default true,
  role text not null default 'operador',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.utilizadores
  drop constraint if exists utilizadores_id_fkey;

alter table public.utilizadores
  alter column id set default gen_random_uuid(),
  add column if not exists username text,
  add column if not exists password_hash text,
  add column if not exists role text not null default 'operador';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'utilizadores'
      and column_name = 'email'
  ) then
    alter table public.utilizadores alter column email drop not null;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'utilizadores_role_check'
      and conrelid = 'public.utilizadores'::regclass
  ) then
    alter table public.utilizadores
      add constraint utilizadores_role_check check (role in ('admin', 'operador'));
  end if;
end;
$$;

create unique index if not exists utilizadores_username_key
  on public.utilizadores (username);

create unique index if not exists utilizadores_username_lower_key
  on public.utilizadores (lower(username));

create table if not exists public.utilizador_sessoes (
  id uuid primary key default gen_random_uuid(),
  utilizador_id uuid not null references public.utilizadores(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_utilizador_sessoes_utilizador
  on public.utilizador_sessoes (utilizador_id, expires_at desc);

alter table public.registos_faturacao
  add column if not exists criado_por_id uuid references public.utilizadores(id) on delete set null,
  add column if not exists criado_por_nome text,
  add column if not exists atualizado_por_id uuid references public.utilizadores(id) on delete set null,
  add column if not exists atualizado_por_nome text;

create table if not exists public.registos_faturacao_auditoria (
  id uuid primary key default gen_random_uuid(),
  registo_id uuid,
  acao text not null check (acao in ('criado', 'editado', 'apagado')),
  utilizador_id uuid references public.utilizadores(id) on delete set null,
  utilizador_nome text not null default 'Sistema',
  utilizador_username text,
  dados_anteriores jsonb,
  dados_novos jsonb,
  created_at timestamptz not null default now()
);

alter table public.registos_faturacao_auditoria
  add column if not exists utilizador_username text;

create index if not exists idx_registos_faturacao_data
  on public.registos_faturacao (data);

create index if not exists idx_registos_faturacao_posto_data
  on public.registos_faturacao (posto_id, data);

create index if not exists idx_registos_faturacao_auditoria_registo
  on public.registos_faturacao_auditoria (registo_id, created_at desc);

create index if not exists idx_registos_faturacao_auditoria_created
  on public.registos_faturacao_auditoria (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_utilizadores_updated_at on public.utilizadores;

create trigger set_utilizadores_updated_at
before update on public.utilizadores
for each row
execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.criar_utilizador_por_auth();
drop function if exists public.utilizador_atual();
drop trigger if exists aplicar_autoria_registo on public.registos_faturacao;
drop trigger if exists registar_auditoria_registo on public.registos_faturacao;
drop trigger if exists set_registos_faturacao_updated_at on public.registos_faturacao;

create or replace function public.app_token_hash(p_token text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

create or replace function public.app_actor(p_token text)
returns table (
  utilizador_id uuid,
  username text,
  nome text,
  role text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  select u.id, u.username, u.nome, u.role
  from public.utilizador_sessoes s
  join public.utilizadores u on u.id = s.utilizador_id
  where s.token_hash = public.app_token_hash(p_token)
    and s.expires_at > now()
    and u.ativo = true
  limit 1;
end;
$$;

create or replace function public.app_require_actor(p_token text)
returns table (
  utilizador_id uuid,
  username text,
  nome text,
  role text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  select a.utilizador_id, a.username, a.nome, a.role
  from public.app_actor(p_token) a
  limit 1;

  if not found then
    raise exception 'Sessão inválida ou expirada' using errcode = '28000';
  end if;
end;
$$;

create or replace function public.app_login(p_username text, p_password text)
returns table (
  token text,
  utilizador_id uuid,
  username text,
  nome text,
  role text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  found_user public.utilizadores%rowtype;
  raw_token text;
  session_expires_at timestamptz := now() + interval '18 hours';
begin
  delete from public.utilizador_sessoes s
  where s.expires_at <= now();

  select *
  into found_user
  from public.utilizadores u
  where lower(u.username) = lower(trim(p_username))
    and u.ativo = true
    and u.password_hash is not null
    and u.password_hash = crypt(p_password, u.password_hash)
  limit 1;

  if not found then
    raise exception 'Username ou password inválidos' using errcode = '28000';
  end if;

  raw_token := encode(gen_random_bytes(32), 'hex');

  insert into public.utilizador_sessoes (utilizador_id, token_hash, expires_at)
  values (found_user.id, public.app_token_hash(raw_token), session_expires_at);

  token := raw_token;
  utilizador_id := found_user.id;
  username := found_user.username;
  nome := found_user.nome;
  role := found_user.role;
  expires_at := session_expires_at;
  return next;
end;
$$;

create or replace function public.app_logout(p_token text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  delete from public.utilizador_sessoes s
  where s.token_hash = public.app_token_hash(p_token);
end;
$$;

create or replace function public.app_utilizador_por_token(p_token text)
returns table (
  utilizador_id uuid,
  username text,
  nome text,
  role text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  select u.id, u.username, u.nome, u.role, s.expires_at
  from public.utilizador_sessoes s
  join public.utilizadores u on u.id = s.utilizador_id
  where s.token_hash = public.app_token_hash(p_token)
    and s.expires_at > now()
    and u.ativo = true
  limit 1;
end;
$$;

create or replace function public.app_listar_postos(p_token text)
returns setof public.postos
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
  from public.postos
  order by nome asc;
end;
$$;

create or replace function public.app_criar_posto(
  p_token text,
  p_nome text,
  p_responsavel text default null
)
returns setof public.postos
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  return query
  insert into public.postos (nome, responsavel)
  values (trim(p_nome), nullif(trim(coalesce(p_responsavel, '')), ''))
  returning *;
end;
$$;

create or replace function public.app_listar_registos(p_token text, p_data date)
returns table (
  id uuid,
  posto_id uuid,
  data date,
  dinheiro numeric,
  multibanco numeric,
  mbway numeric,
  observacoes text,
  criado_por_id uuid,
  criado_por_nome text,
  atualizado_por_id uuid,
  atualizado_por_nome text,
  created_at timestamptz,
  updated_at timestamptz,
  posto_nome text,
  posto_responsavel text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  return query
  select
    r.id,
    r.posto_id,
    r.data,
    r.dinheiro,
    r.multibanco,
    r.mbway,
    r.observacoes,
    r.criado_por_id,
    r.criado_por_nome,
    r.atualizado_por_id,
    r.atualizado_por_nome,
    r.created_at,
    r.updated_at,
    p.nome as posto_nome,
    p.responsavel as posto_responsavel
  from public.registos_faturacao r
  left join public.postos p on p.id = r.posto_id
  where r.data = p_data
  order by p.nome asc, r.created_at asc;
end;
$$;

create or replace function public.app_guardar_registo(
  p_token text,
  p_posto_id uuid,
  p_data date,
  p_dinheiro numeric,
  p_multibanco numeric,
  p_mbway numeric,
  p_observacoes text default null,
  p_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
  existing_registo public.registos_faturacao%rowtype;
  saved_id uuid;
  old_data jsonb;
  new_data jsonb;
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  if p_id is not null then
    select *
    into existing_registo
    from public.registos_faturacao r
    where r.id = p_id
    for update;

    if existing_registo.id is null then
      raise exception 'Registo de faturação não encontrado' using errcode = '02000';
    end if;

    old_data := to_jsonb(existing_registo);

    update public.registos_faturacao
    set posto_id = p_posto_id,
        data = p_data,
        dinheiro = p_dinheiro,
        multibanco = p_multibanco,
        mbway = p_mbway,
        observacoes = nullif(trim(coalesce(p_observacoes, '')), ''),
        atualizado_por_id = actor.utilizador_id,
        atualizado_por_nome = actor.nome,
        updated_at = now()
    where id = p_id
    returning registos_faturacao.id, to_jsonb(registos_faturacao)
    into saved_id, new_data;

    insert into public.registos_faturacao_auditoria (
      registo_id,
      acao,
      utilizador_id,
      utilizador_nome,
      utilizador_username,
      dados_anteriores,
      dados_novos
    )
    values (
      saved_id,
      'editado',
      actor.utilizador_id,
      actor.nome,
      actor.username,
      old_data,
      new_data
    );

    return saved_id;
  end if;

  insert into public.registos_faturacao (
    posto_id,
    data,
    dinheiro,
    multibanco,
    mbway,
    observacoes,
    criado_por_id,
    criado_por_nome,
    atualizado_por_id,
    atualizado_por_nome
  )
  values (
    p_posto_id,
    p_data,
    p_dinheiro,
    p_multibanco,
    p_mbway,
    nullif(trim(coalesce(p_observacoes, '')), ''),
    actor.utilizador_id,
    actor.nome,
    actor.utilizador_id,
    actor.nome
  )
  returning registos_faturacao.id, to_jsonb(registos_faturacao)
  into saved_id, new_data;

  insert into public.registos_faturacao_auditoria (
    registo_id,
    acao,
    utilizador_id,
    utilizador_nome,
    utilizador_username,
    dados_anteriores,
    dados_novos
  )
  values (
    saved_id,
    'criado',
    actor.utilizador_id,
    actor.nome,
    actor.username,
    null,
    new_data
  );

  return saved_id;
end;
$$;

create or replace function public.app_apagar_registo(p_token text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
  old_registo public.registos_faturacao%rowtype;
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  select *
  into old_registo
  from public.registos_faturacao
  where id = p_id
  limit 1;

  if not found then
    return;
  end if;

  delete from public.registos_faturacao
  where id = p_id;

  insert into public.registos_faturacao_auditoria (
    registo_id,
    acao,
    utilizador_id,
    utilizador_nome,
    utilizador_username,
    dados_anteriores,
    dados_novos
  )
  values (
    old_registo.id,
    'apagado',
    actor.utilizador_id,
    actor.nome,
    actor.username,
    to_jsonb(old_registo),
    null
  );
end;
$$;

create or replace function public.app_listar_utilizadores(p_token text)
returns table (
  id uuid,
  username text,
  nome text,
  ativo boolean,
  role text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  if actor.role <> 'admin' then
    raise exception 'Apenas administradores podem listar utilizadores' using errcode = '42501';
  end if;

  return query
  select u.id, u.username, u.nome, u.ativo, u.role, u.created_at, u.updated_at
  from public.utilizadores u
  order by u.ativo desc, u.username asc;
end;
$$;

create or replace function public.app_guardar_utilizador(
  p_token text,
  p_id uuid default null,
  p_username text default null,
  p_nome text default null,
  p_password text default null,
  p_ativo boolean default true,
  p_role text default 'operador'
)
returns table (
  id uuid,
  username text,
  nome text,
  ativo boolean,
  role text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
  saved_id uuid;
  normalized_username text := trim(coalesce(p_username, ''));
  normalized_nome text := trim(coalesce(p_nome, ''));
  normalized_role text := case when p_role = 'admin' then 'admin' else 'operador' end;
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  if actor.role <> 'admin' then
    raise exception 'Apenas administradores podem gerir utilizadores' using errcode = '42501';
  end if;

  if normalized_username = '' then
    raise exception 'Indica o username' using errcode = '22023';
  end if;

  if normalized_nome = '' then
    raise exception 'Indica o nome' using errcode = '22023';
  end if;

  if p_id is null and nullif(p_password, '') is null then
    raise exception 'Indica a password inicial' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.utilizadores (username, nome, password_hash, ativo, role)
    values (
      normalized_username,
      normalized_nome,
      crypt(p_password, gen_salt('bf')),
      coalesce(p_ativo, true),
      normalized_role
    )
    returning utilizadores.id into saved_id;
  elsif nullif(p_password, '') is null then
    update public.utilizadores
    set username = normalized_username,
        nome = normalized_nome,
        ativo = coalesce(p_ativo, true),
        role = normalized_role,
        updated_at = now()
    where utilizadores.id = p_id
    returning utilizadores.id into saved_id;
  else
    update public.utilizadores
    set username = normalized_username,
        nome = normalized_nome,
        password_hash = crypt(p_password, gen_salt('bf')),
        ativo = coalesce(p_ativo, true),
        role = normalized_role,
        updated_at = now()
    where utilizadores.id = p_id
    returning utilizadores.id into saved_id;
  end if;

  if saved_id is null then
    raise exception 'Utilizador não encontrado' using errcode = '02000';
  end if;

  return query
  select u.id, u.username, u.nome, u.ativo, u.role, u.created_at, u.updated_at
  from public.utilizadores u
  where u.id = saved_id;
end;
$$;

alter table public.utilizadores enable row level security;
alter table public.utilizador_sessoes enable row level security;
alter table public.registos_faturacao_auditoria enable row level security;

drop policy if exists "Equipa autenticada pode ler utilizadores" on public.utilizadores;
drop policy if exists "Cada utilizador pode criar o seu perfil" on public.utilizadores;
drop policy if exists "Cada utilizador pode editar o seu perfil" on public.utilizadores;
drop policy if exists "Equipa autenticada pode ler auditoria" on public.registos_faturacao_auditoria;

insert into public.utilizadores (username, nome, password_hash, ativo, role)
values
  ('Jgalaio', 'Jgalaio', '$1$JgPont$N/24v2dcdAT2wQSCUsJxY1', true, 'admin'),
  ('ALopes', 'ALopes', '$1$ALPont$0eq/xYqrlrfvTguwjzcTz1', true, 'operador')
on conflict (username) do update
set nome = excluded.nome,
    password_hash = excluded.password_hash,
    ativo = excluded.ativo,
    role = excluded.role,
    updated_at = now();

grant execute on all functions in schema public to anon, authenticated;
