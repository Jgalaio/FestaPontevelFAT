alter table public.pagamentos_agente
  add column if not exists atualizado_por_id uuid references public.utilizadores(id) on delete set null,
  add column if not exists atualizado_por_nome text,
  add column if not exists justificacao_alteracao text,
  add column if not exists updated_at timestamptz;

update public.pagamentos_agente
set updated_at = created_at
where updated_at is null;

alter table public.pagamentos_agente
  alter column updated_at set default now();

create table if not exists public.pagamentos_agente_auditoria (
  id uuid primary key default gen_random_uuid(),
  pagamento_id uuid not null,
  acao text not null check (acao in ('editado', 'apagado')),
  utilizador_id uuid references public.utilizadores(id) on delete set null,
  utilizador_nome text not null,
  utilizador_username text,
  justificacao text not null,
  dados_anteriores jsonb,
  dados_novos jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_pagamentos_agente_auditoria_pagamento
  on public.pagamentos_agente_auditoria (pagamento_id, created_at desc);

create index if not exists idx_pagamentos_agente_auditoria_created
  on public.pagamentos_agente_auditoria (created_at desc);

alter table public.pagamentos_agente_auditoria enable row level security;

create or replace function public.app_editar_pagamento_agente(
  p_token text,
  p_id uuid,
  p_valor numeric,
  p_justificacao text
)
returns setof public.pagamentos_agente
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
  existing_pagamento public.pagamentos_agente%rowtype;
  normalized_justificacao text;
  old_data jsonb;
  new_data jsonb;
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  if coalesce(p_valor, 0) <= 0 then
    raise exception 'Indica um valor entregue ao agente maior que zero' using errcode = '22023';
  end if;

  normalized_justificacao := nullif(
    regexp_replace(trim(coalesce(p_justificacao, '')), '[[:space:]]+', ' ', 'g'),
    ''
  );

  if normalized_justificacao is null then
    raise exception 'Indica a justificação da alteração antes de guardar' using errcode = '22023';
  end if;

  select *
  into existing_pagamento
  from public.pagamentos_agente
  where id = p_id
  for update;

  if existing_pagamento.id is null then
    raise exception 'Entrega ao agente não encontrada' using errcode = '02000';
  end if;

  old_data := to_jsonb(existing_pagamento);

  update public.pagamentos_agente
  set valor = p_valor,
      atualizado_por_id = actor.utilizador_id,
      atualizado_por_nome = actor.nome,
      justificacao_alteracao = normalized_justificacao,
      updated_at = now()
  where id = p_id
  returning to_jsonb(pagamentos_agente)
  into new_data;

  insert into public.pagamentos_agente_auditoria (
    pagamento_id,
    acao,
    utilizador_id,
    utilizador_nome,
    utilizador_username,
    justificacao,
    dados_anteriores,
    dados_novos
  )
  values (
    p_id,
    'editado',
    actor.utilizador_id,
    actor.nome,
    actor.username,
    normalized_justificacao,
    old_data,
    new_data
  );

  return query
  select *
  from public.pagamentos_agente
  where id = p_id;
end;
$$;

create or replace function public.app_apagar_pagamento_agente(
  p_token text,
  p_id uuid,
  p_justificacao text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
  existing_pagamento public.pagamentos_agente%rowtype;
  normalized_justificacao text;
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  if actor.role <> 'admin' then
    raise exception 'Não tem privilégios para apagar dados inseridos' using errcode = '42501';
  end if;

  normalized_justificacao := nullif(
    regexp_replace(trim(coalesce(p_justificacao, '')), '[[:space:]]+', ' ', 'g'),
    ''
  );

  if normalized_justificacao is null then
    raise exception 'Indica a justificação para apagar a entrega ao agente' using errcode = '22023';
  end if;

  select *
  into existing_pagamento
  from public.pagamentos_agente
  where id = p_id
  for update;

  if existing_pagamento.id is null then
    return;
  end if;

  insert into public.pagamentos_agente_auditoria (
    pagamento_id,
    acao,
    utilizador_id,
    utilizador_nome,
    utilizador_username,
    justificacao,
    dados_anteriores,
    dados_novos
  )
  values (
    p_id,
    'apagado',
    actor.utilizador_id,
    actor.nome,
    actor.username,
    normalized_justificacao,
    to_jsonb(existing_pagamento),
    null
  );

  delete from public.pagamentos_agente
  where id = p_id;
end;
$$;

grant execute on function public.app_editar_pagamento_agente(text, uuid, numeric, text) to anon, authenticated;
grant execute on function public.app_apagar_pagamento_agente(text, uuid, text) to anon, authenticated;
