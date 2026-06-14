alter table public.registos_faturacao
  drop constraint if exists registos_faturacao_posto_id_data_key;

do $$
declare
  unique_constraint record;
begin
  for unique_constraint in
    select c.conname
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'registos_faturacao'
      and c.contype = 'u'
      and (
        select array_agg(a.attname order by a.attname)
        from unnest(c.conkey) column_number
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = column_number
      ) = array['data', 'posto_id']
  loop
    execute format('alter table public.registos_faturacao drop constraint %I', unique_constraint.conname);
  end loop;
end;
$$;

drop function if exists public.app_guardar_registo(text, uuid, date, numeric, numeric, numeric, text);

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
  perform public.app_require_dia_aberto(p_data);

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

grant execute on function public.app_guardar_registo(text, uuid, date, numeric, numeric, numeric, text, uuid) to anon, authenticated;
