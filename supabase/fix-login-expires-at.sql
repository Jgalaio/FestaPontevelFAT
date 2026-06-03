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
