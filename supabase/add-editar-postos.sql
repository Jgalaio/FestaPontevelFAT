create or replace function public.app_guardar_posto(
  p_token text,
  p_id uuid default null,
  p_nome text default null,
  p_responsavel text default null,
  p_ativo boolean default true
)
returns setof public.postos
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
    raise exception 'Indica o nome do posto' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.postos p
    where lower(p.nome) = lower(normalized_nome)
      and (p_id is null or p.id <> p_id)
  ) then
    raise exception 'Esse posto já existe' using errcode = '23505';
  end if;

  if p_id is null then
    insert into public.postos (nome, responsavel, ativo)
    values (
      normalized_nome,
      nullif(trim(coalesce(p_responsavel, '')), ''),
      coalesce(p_ativo, true)
    )
    returning postos.id into saved_id;
  else
    update public.postos
    set nome = normalized_nome,
        responsavel = nullif(trim(coalesce(p_responsavel, '')), ''),
        ativo = coalesce(p_ativo, true)
    where postos.id = p_id
    returning postos.id into saved_id;
  end if;

  if saved_id is null then
    raise exception 'Posto não encontrado' using errcode = '02000';
  end if;

  return query
  select *
  from public.postos
  where id = saved_id;
end;
$$;

create or replace function public.app_apagar_posto(p_token text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  update public.postos
  set ativo = false
  where id = p_id;
end;
$$;

grant execute on all functions in schema public to anon, authenticated;
