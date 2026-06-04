alter table public.despesas_posto
add column if not exists fatura_imagem text;

drop function if exists public.app_listar_despesas(text, date);

create or replace function public.app_listar_despesas(p_token text, p_data date)
returns table (
  id uuid,
  posto_id uuid,
  data date,
  tipo_despesa text,
  numero_despesa text,
  valor numeric,
  fat_com_nif boolean,
  tipo_pagamento text,
  fatura_paga boolean,
  numero_fatura text,
  fatura_imagem text,
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
    d.id,
    d.posto_id,
    d.data,
    d.tipo_despesa,
    d.numero_despesa,
    d.valor,
    d.fat_com_nif,
    d.tipo_pagamento,
    d.fatura_paga,
    d.numero_fatura,
    d.fatura_imagem,
    d.observacoes,
    d.criado_por_id,
    d.criado_por_nome,
    d.atualizado_por_id,
    d.atualizado_por_nome,
    d.created_at,
    d.updated_at,
    p.nome as posto_nome,
    p.responsavel as posto_responsavel
  from public.despesas_posto d
  left join public.postos p on p.id = d.posto_id
  where d.data = p_data
  order by p.nome asc, d.created_at asc;
end;
$$;

drop function if exists public.app_guardar_despesa(text, uuid, uuid, date, text, text, numeric, boolean, text, text);
drop function if exists public.app_guardar_despesa(text, uuid, uuid, date, text, text, numeric, boolean, text, boolean, text, text);
drop function if exists public.app_guardar_despesa(text, uuid, uuid, date, text, text, numeric, boolean, text, boolean, text, text, text);

create or replace function public.app_guardar_despesa(
  p_token text,
  p_id uuid default null,
  p_posto_id uuid default null,
  p_data date default null,
  p_tipo_despesa text default null,
  p_numero_despesa text default null,
  p_valor numeric default 0,
  p_fat_com_nif boolean default false,
  p_tipo_pagamento text default 'dinheiro',
  p_fatura_paga boolean default false,
  p_numero_fatura text default null,
  p_fatura_imagem text default null,
  p_observacoes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
  existing_despesa public.despesas_posto%rowtype;
  saved_id uuid;
  old_data jsonb;
  new_data jsonb;
  normalized_tipo text := trim(coalesce(p_tipo_despesa, ''));
  normalized_numero text := trim(coalesce(p_numero_despesa, ''));
  normalized_numero_fatura text := nullif(trim(coalesce(p_numero_fatura, '')), '');
  normalized_fatura_imagem text := nullif(trim(coalesce(p_fatura_imagem, '')), '');
  normalized_tipo_pagamento text := case when p_tipo_pagamento = 'transferencia' then 'transferencia' else 'dinheiro' end;
  resolved_numero text;
  next_numero integer;
begin
  select * into actor from public.app_require_actor(p_token) limit 1;
  perform public.app_require_dia_aberto(p_data);

  if p_posto_id is null then
    raise exception 'Escolhe um posto para a despesa' using errcode = '22023';
  end if;

  if normalized_tipo = '' then
    raise exception 'Escolhe o tipo de despesa' using errcode = '22023';
  end if;

  if coalesce(p_valor, 0) < 0 then
    raise exception 'O valor da despesa não pode ser negativo' using errcode = '22023';
  end if;

  if coalesce(p_fatura_paga, false) and normalized_numero_fatura is null then
    raise exception 'Indica o número da fatura paga' using errcode = '22023';
  end if;

  if p_id is not null then
    select *
    into existing_despesa
    from public.despesas_posto d
    where d.id = p_id
    limit 1;

    if not found then
      raise exception 'Despesa não encontrada' using errcode = '02000';
    end if;

    old_data := to_jsonb(existing_despesa);
    resolved_numero := coalesce(nullif(normalized_numero, ''), existing_despesa.numero_despesa);

    update public.despesas_posto
    set posto_id = p_posto_id,
        data = p_data,
        tipo_despesa = normalized_tipo,
        numero_despesa = resolved_numero,
        valor = coalesce(p_valor, 0),
        fat_com_nif = coalesce(p_fat_com_nif, false),
        tipo_pagamento = normalized_tipo_pagamento,
        fatura_paga = coalesce(p_fatura_paga, false),
        numero_fatura = normalized_numero_fatura,
        fatura_imagem = normalized_fatura_imagem,
        observacoes = nullif(trim(coalesce(p_observacoes, '')), ''),
        atualizado_por_id = actor.utilizador_id,
        atualizado_por_nome = actor.nome,
        updated_at = now()
    where id = existing_despesa.id
    returning despesas_posto.id, to_jsonb(despesas_posto)
    into saved_id, new_data;

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

  if normalized_numero = '' then
    select coalesce(max((substring(d.numero_despesa from '^D-([0-9]+)$'))::integer), 0) + 1
    into next_numero
    from public.despesas_posto d
    where d.posto_id = p_posto_id
      and d.data = p_data
      and d.numero_despesa ~ '^D-[0-9]+$';

    resolved_numero := 'D-' || lpad(coalesce(next_numero, 1)::text, 3, '0');
  else
    resolved_numero := normalized_numero;
  end if;

  insert into public.despesas_posto (
    posto_id,
    data,
    tipo_despesa,
    numero_despesa,
    valor,
    fat_com_nif,
    tipo_pagamento,
    fatura_paga,
    numero_fatura,
    fatura_imagem,
    observacoes,
    criado_por_id,
    criado_por_nome,
    atualizado_por_id,
    atualizado_por_nome
  )
  values (
    p_posto_id,
    p_data,
    normalized_tipo,
    resolved_numero,
    coalesce(p_valor, 0),
    coalesce(p_fat_com_nif, false),
    normalized_tipo_pagamento,
    coalesce(p_fatura_paga, false),
    normalized_numero_fatura,
    normalized_fatura_imagem,
    nullif(trim(coalesce(p_observacoes, '')), ''),
    actor.utilizador_id,
    actor.nome,
    actor.utilizador_id,
    actor.nome
  )
  returning despesas_posto.id, to_jsonb(despesas_posto)
  into saved_id, new_data;

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
