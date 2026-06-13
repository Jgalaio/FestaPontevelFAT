alter table public.dias_festa
  add column if not exists reaberto_por_id uuid references public.utilizadores(id) on delete set null,
  add column if not exists reaberto_por_nome text,
  add column if not exists reaberto_at timestamptz,
  add column if not exists reabertura_justificacao text;

create or replace function public.app_fechar_dia(p_token text, p_id uuid)
returns setof public.dias_festa
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
  saved_id uuid;
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  update public.dias_festa
  set fechado = true,
      fechado_por_id = actor.utilizador_id,
      fechado_por_nome = actor.nome,
      fechado_at = now(),
      atualizado_por_id = actor.utilizador_id,
      atualizado_por_nome = actor.nome,
      updated_at = now()
  where id = p_id
  returning dias_festa.id into saved_id;

  if saved_id is null then
    raise exception 'Dia não encontrado' using errcode = '02000';
  end if;

  return query
  select *
  from public.dias_festa
  where id = saved_id;
end;
$$;

create or replace function public.app_reabrir_dia(
  p_token text,
  p_id uuid,
  p_justificacao text
)
returns setof public.dias_festa
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
  saved_id uuid;
  normalized_justificacao text := nullif(regexp_replace(trim(coalesce(p_justificacao, '')), '[[:space:]]+', ' ', 'g'), '');
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  if actor.role <> 'admin' then
    raise exception 'Apenas administradores podem reabrir dias' using errcode = '42501';
  end if;

  if normalized_justificacao is null then
    raise exception 'Indica a justificação para reabrir o dia' using errcode = '22023';
  end if;

  update public.dias_festa
  set fechado = false,
      reaberto_por_id = actor.utilizador_id,
      reaberto_por_nome = actor.nome,
      reaberto_at = now(),
      reabertura_justificacao = normalized_justificacao,
      atualizado_por_id = actor.utilizador_id,
      atualizado_por_nome = actor.nome,
      updated_at = now()
  where id = p_id
    and fechado = true
  returning dias_festa.id into saved_id;

  if saved_id is null then
    raise exception 'Dia não encontrado ou já está aberto' using errcode = '02000';
  end if;

  return query
  select *
  from public.dias_festa
  where id = saved_id;
end;
$$;

grant execute on function public.app_fechar_dia(text, uuid) to anon, authenticated;
grant execute on function public.app_reabrir_dia(text, uuid, text) to anon, authenticated;
