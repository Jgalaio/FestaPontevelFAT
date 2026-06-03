create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function public.app_token_hash(p_token text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
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
