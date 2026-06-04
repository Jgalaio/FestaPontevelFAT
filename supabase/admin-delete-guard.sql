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

  if actor.role <> 'admin' then
    raise exception 'Não tem privilégios para apagar dados inseridos' using errcode = '42501';
  end if;

  select *
  into old_registo
  from public.registos_faturacao
  where id = p_id
  limit 1;

  if not found then
    return;
  end if;

  perform public.app_require_dia_aberto(old_registo.data);

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

create or replace function public.app_apagar_despesa(p_token text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
  old_despesa public.despesas_posto%rowtype;
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  if actor.role <> 'admin' then
    raise exception 'Não tem privilégios para apagar dados inseridos' using errcode = '42501';
  end if;

  select *
  into old_despesa
  from public.despesas_posto
  where id = p_id
  limit 1;

  if not found then
    return;
  end if;

  perform public.app_require_dia_aberto(old_despesa.data);

  delete from public.despesas_posto
  where id = p_id;

  insert into public.despesas_posto_auditoria (
    despesa_id,
    acao,
    utilizador_id,
    utilizador_nome,
    utilizador_username,
    dados_anteriores,
    dados_novos
  )
  values (
    old_despesa.id,
    'apagado',
    actor.utilizador_id,
    actor.nome,
    actor.username,
    to_jsonb(old_despesa),
    null
  );
end;
$$;
