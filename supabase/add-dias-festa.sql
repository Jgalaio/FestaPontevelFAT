create extension if not exists pgcrypto;

create table if not exists public.dias_festa (
  id uuid primary key default gen_random_uuid(),
  data date not null unique,
  nome text not null,
  fechado boolean not null default false,
  fechado_por_id uuid references public.utilizadores(id) on delete set null,
  fechado_por_nome text,
  fechado_at timestamptz,
  criado_por_id uuid references public.utilizadores(id) on delete set null,
  criado_por_nome text,
  atualizado_por_id uuid references public.utilizadores(id) on delete set null,
  atualizado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dias_festa_data
  on public.dias_festa (data);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_dias_festa_updated_at on public.dias_festa;

create trigger set_dias_festa_updated_at
before update on public.dias_festa
for each row
execute function public.set_updated_at();

with datas_existentes as (
  select data from public.registos_faturacao
  union
  select data from public.despesas_posto
),
dias_numerados as (
  select
    data,
    row_number() over (order by data) as numero
  from datas_existentes
)
insert into public.dias_festa (data, nome, criado_por_nome, atualizado_por_nome)
select data, 'Dia ' || numero::text, 'Sistema', 'Sistema'
from dias_numerados
on conflict (data) do nothing;

insert into public.dias_festa (data, nome, criado_por_nome, atualizado_por_nome)
select current_date, 'Dia inicial', 'Sistema', 'Sistema'
where not exists (select 1 from public.dias_festa);

create or replace function public.app_require_dia_aberto(p_data date)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_dia public.dias_festa%rowtype;
begin
  if p_data is null then
    raise exception 'Seleciona um dia da festa' using errcode = '22023';
  end if;

  select *
  into target_dia
  from public.dias_festa d
  where d.data = p_data
  limit 1;

  if not found then
    raise exception 'Cria primeiro o dia da festa na Gestão' using errcode = '22023';
  end if;

  if target_dia.fechado then
    raise exception 'Este dia está fechado e já não permite alterações' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.app_listar_dias(p_token text)
returns setof public.dias_festa
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
  from public.dias_festa
  order by data asc;
end;
$$;

create or replace function public.app_guardar_dia(
  p_token text,
  p_data date,
  p_nome text default null
)
returns setof public.dias_festa
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
  saved_id uuid;
  normalized_nome text := nullif(trim(coalesce(p_nome, '')), '');
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  if p_data is null then
    raise exception 'Indica a data do dia da festa' using errcode = '22023';
  end if;

  if exists (select 1 from public.dias_festa d where d.data = p_data) then
    raise exception 'Esse dia já existe' using errcode = '23505';
  end if;

  insert into public.dias_festa (
    data,
    nome,
    criado_por_id,
    criado_por_nome,
    atualizado_por_id,
    atualizado_por_nome
  )
  values (
    p_data,
    coalesce(normalized_nome, 'Dia ' || to_char(p_data, 'DD/MM/YYYY')),
    actor.utilizador_id,
    actor.nome,
    actor.utilizador_id,
    actor.nome
  )
  returning dias_festa.id into saved_id;

  return query
  select *
  from public.dias_festa
  where id = saved_id;
end;
$$;

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
      fechado_at = coalesce(fechado_at, now()),
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

create or replace function public.app_apagar_dia(
  p_token text,
  p_id uuid,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
  target_dia public.dias_festa%rowtype;
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  if coalesce(p_password, '') <> '21051986Gz!' then
    raise exception 'Password inválida' using errcode = '28000';
  end if;

  select *
  into target_dia
  from public.dias_festa
  where id = p_id
  limit 1;

  if not found then
    return;
  end if;

  insert into public.registos_faturacao_auditoria (
    registo_id,
    acao,
    utilizador_id,
    utilizador_nome,
    utilizador_username,
    dados_anteriores,
    dados_novos
  )
  select
    r.id,
    'apagado',
    actor.utilizador_id,
    actor.nome,
    actor.username,
    to_jsonb(r),
    null
  from public.registos_faturacao r
  where r.data = target_dia.data;

  insert into public.despesas_posto_auditoria (
    despesa_id,
    acao,
    utilizador_id,
    utilizador_nome,
    utilizador_username,
    dados_anteriores,
    dados_novos
  )
  select
    d.id,
    'apagado',
    actor.utilizador_id,
    actor.nome,
    actor.username,
    to_jsonb(d),
    null
  from public.despesas_posto d
  where d.data = target_dia.data;

  delete from public.registos_faturacao
  where data = target_dia.data;

  delete from public.despesas_posto
  where data = target_dia.data;

  delete from public.dias_festa
  where id = target_dia.id;
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

create or replace function public.app_guardar_despesa(
  p_token text,
  p_id uuid default null,
  p_posto_id uuid default null,
  p_data date default null,
  p_tipo_despesa text default null,
  p_numero_despesa text default null,
  p_valor numeric default 0,
  p_fatura_paga boolean default false,
  p_numero_fatura text default null,
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
begin
  select * into actor from public.app_require_actor(p_token) limit 1;
  perform public.app_require_dia_aberto(p_data);

  if p_posto_id is null then
    raise exception 'Escolhe um posto para a despesa' using errcode = '22023';
  end if;

  if normalized_tipo = '' then
    raise exception 'Escolhe o tipo de despesa' using errcode = '22023';
  end if;

  if normalized_numero = '' then
    raise exception 'Indica o número da despesa' using errcode = '22023';
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

    update public.despesas_posto
    set posto_id = p_posto_id,
        data = p_data,
        tipo_despesa = normalized_tipo,
        numero_despesa = normalized_numero,
        valor = coalesce(p_valor, 0),
        fatura_paga = coalesce(p_fatura_paga, false),
        numero_fatura = case when coalesce(p_fatura_paga, false) then normalized_numero_fatura else null end,
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

  insert into public.despesas_posto (
    posto_id,
    data,
    tipo_despesa,
    numero_despesa,
    valor,
    fatura_paga,
    numero_fatura,
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
    normalized_numero,
    coalesce(p_valor, 0),
    coalesce(p_fatura_paga, false),
    case when coalesce(p_fatura_paga, false) then normalized_numero_fatura else null end,
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

alter table public.dias_festa enable row level security;

drop policy if exists "Equipa autenticada pode ler dias festa" on public.dias_festa;
drop policy if exists "Equipa autenticada pode criar dias festa" on public.dias_festa;
drop policy if exists "Equipa autenticada pode editar dias festa" on public.dias_festa;
drop policy if exists "Equipa autenticada pode apagar dias festa" on public.dias_festa;

grant execute on all functions in schema public to anon, authenticated;
