create extension if not exists pgcrypto;

create table if not exists public.despesas_posto (
  id uuid primary key default gen_random_uuid(),
  posto_id uuid not null references public.postos(id) on delete restrict,
  data date not null,
  tipo_despesa text not null,
  numero_despesa text not null,
  valor numeric(12, 2) not null default 0 check (valor >= 0),
  fatura_paga boolean not null default false,
  numero_fatura text,
  observacoes text,
  criado_por_id uuid references public.utilizadores(id) on delete set null,
  criado_por_nome text,
  atualizado_por_id uuid references public.utilizadores(id) on delete set null,
  atualizado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.despesas_posto_auditoria (
  id uuid primary key default gen_random_uuid(),
  despesa_id uuid,
  acao text not null check (acao in ('criado', 'editado', 'apagado')),
  utilizador_id uuid references public.utilizadores(id) on delete set null,
  utilizador_nome text not null default 'Sistema',
  utilizador_username text,
  dados_anteriores jsonb,
  dados_novos jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_despesas_posto_data
  on public.despesas_posto (data);

create index if not exists idx_despesas_posto_posto_data
  on public.despesas_posto (posto_id, data);

create index if not exists idx_despesas_posto_auditoria_despesa
  on public.despesas_posto_auditoria (despesa_id, created_at desc);

create index if not exists idx_despesas_posto_auditoria_created
  on public.despesas_posto_auditoria (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_despesas_posto_updated_at on public.despesas_posto;

create trigger set_despesas_posto_updated_at
before update on public.despesas_posto
for each row
execute function public.set_updated_at();

create or replace function public.app_listar_despesas(p_token text, p_data date)
returns table (
  id uuid,
  posto_id uuid,
  data date,
  tipo_despesa text,
  numero_despesa text,
  valor numeric,
  fatura_paga boolean,
  numero_fatura text,
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
    d.fatura_paga,
    d.numero_fatura,
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

  if p_posto_id is null then
    raise exception 'Escolhe um posto para a despesa' using errcode = '22023';
  end if;

  if p_data is null then
    raise exception 'Indica a data da despesa' using errcode = '22023';
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

drop view if exists public.totais_diarios;

create view public.totais_diarios
with (security_invoker = true)
as
with faturacao as (
  select
    r.data,
    count(*) as postos_registados,
    sum(r.dinheiro) as dinheiro,
    sum(r.multibanco) as multibanco,
    sum(r.mbway) as mbway,
    sum(r.dinheiro + r.multibanco + r.mbway) as total
  from public.registos_faturacao r
  group by r.data
),
despesas as (
  select
    d.data,
    sum(d.valor) as despesas_total
  from public.despesas_posto d
  group by d.data
)
select
  coalesce(faturacao.data, despesas.data) as data,
  coalesce(faturacao.postos_registados, 0) as postos_registados,
  coalesce(faturacao.dinheiro, 0) as dinheiro,
  coalesce(faturacao.multibanco, 0) as multibanco,
  coalesce(faturacao.mbway, 0) as mbway,
  coalesce(faturacao.total, 0) as total,
  coalesce(despesas.despesas_total, 0) as despesas_total,
  coalesce(faturacao.total, 0) - coalesce(despesas.despesas_total, 0) as saldo
from faturacao
full outer join despesas on despesas.data = faturacao.data;

alter table public.despesas_posto enable row level security;
alter table public.despesas_posto_auditoria enable row level security;

drop policy if exists "Equipa autenticada pode ler despesas" on public.despesas_posto;
drop policy if exists "Equipa autenticada pode criar despesas" on public.despesas_posto;
drop policy if exists "Equipa autenticada pode editar despesas" on public.despesas_posto;
drop policy if exists "Equipa autenticada pode apagar despesas" on public.despesas_posto;
drop policy if exists "Equipa autenticada pode ler auditoria despesas" on public.despesas_posto_auditoria;

grant execute on all functions in schema public to anon, authenticated;
