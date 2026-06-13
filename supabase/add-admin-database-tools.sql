create table if not exists public.app_config (
  id boolean primary key default true,
  favicon_data_url text,
  atualizado_por_id uuid references public.utilizadores(id) on delete set null,
  atualizado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_config_singleton check (id)
);

alter table public.app_config
  add column if not exists favicon_data_url text,
  add column if not exists atualizado_por_id uuid references public.utilizadores(id) on delete set null,
  add column if not exists atualizado_por_nome text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

insert into public.app_config (id)
values (true)
on conflict (id) do nothing;

alter table public.app_config enable row level security;

create or replace function public.app_admin_actor(p_token text)
returns table (
  utilizador_id uuid,
  username text,
  nome text,
  role text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  select a.utilizador_id, a.username, a.nome, a.role
  from public.app_require_actor(p_token) a
  where a.role = 'admin'
  limit 1;

  if not found then
    raise exception 'Apenas administradores podem executar esta ação' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.app_exportar_base_dados(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
begin
  select * into actor from public.app_admin_actor(p_token) limit 1;

  return jsonb_build_object(
    'app', 'FestaSoft',
    'version', 1,
    'exported_at', now(),
    'exported_by', actor.nome,
    'data', jsonb_build_object(
      'appConfig', coalesce((select to_jsonb(c) from public.app_config c where c.id = true), 'null'::jsonb),
      'agenteConfig', coalesce((select to_jsonb(c) from public.agente_config c where c.id = true), 'null'::jsonb),
      'novadisConfig', coalesce((select to_jsonb(c) from public.novadis_config c where c.id = true), 'null'::jsonb),
      'diasFesta', coalesce((select jsonb_agg(to_jsonb(d) order by d.data asc) from public.dias_festa d), '[]'::jsonb),
      'postos', coalesce((select jsonb_agg(to_jsonb(p) order by p.nome asc) from public.postos p), '[]'::jsonb),
      'registos', coalesce((select jsonb_agg(to_jsonb(r) order by r.data asc, r.created_at asc) from public.registos_faturacao r), '[]'::jsonb),
      'despesas', coalesce((select jsonb_agg(to_jsonb(d) order by d.data asc, d.created_at asc) from public.despesas_posto d), '[]'::jsonb),
      'tiposDespesa', coalesce((select jsonb_agg(to_jsonb(t) order by t.nome asc) from public.tipos_despesa t), '[]'::jsonb),
      'pagamentosAgente', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at asc) from public.pagamentos_agente p), '[]'::jsonb),
      'novadisBarris', coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at asc) from public.novadis_barris b), '[]'::jsonb),
      'novadisConsumos', coalesce((select jsonb_agg(to_jsonb(c) order by c.data asc, c.created_at asc) from public.novadis_consumos c), '[]'::jsonb),
      'tabaqueiraEntradas', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at asc) from public.tabaqueira_entradas e), '[]'::jsonb),
      'tabaqueiraSaidas', coalesce((select jsonb_agg(to_jsonb(s) order by s.data asc, s.created_at asc) from public.tabaqueira_saidas s), '[]'::jsonb),
      'inventarioTipos', coalesce((select jsonb_agg(to_jsonb(t) order by t.nome asc) from public.inventario_tipos_produto t), '[]'::jsonb),
      'inventarioProdutos', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at asc) from public.inventario_produtos p), '[]'::jsonb),
      'anotacoes', coalesce((select jsonb_agg(to_jsonb(a) order by a.updated_at desc) from public.anotacoes a), '[]'::jsonb)
    )
  );
end;
$$;

create or replace function public.app_reset_base_dados(p_token text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
begin
  select * into actor from public.app_admin_actor(p_token) limit 1;

  delete from public.registos_faturacao_auditoria;
  delete from public.despesas_posto_auditoria;
  delete from public.anotacoes;
  delete from public.inventario_produtos;
  delete from public.inventario_tipos_produto;
  delete from public.tabaqueira_saidas;
  delete from public.tabaqueira_entradas;
  delete from public.novadis_consumos;
  delete from public.novadis_barris;
  delete from public.pagamentos_agente;
  delete from public.despesas_posto;
  delete from public.registos_faturacao;
  delete from public.dias_festa;
  delete from public.tipos_despesa;
  delete from public.postos;

  insert into public.agente_config (
    id,
    valor_eventos_anual,
    valor_patrocinios,
    valor_peditorio,
    valor_necessario_agente,
    atualizado_por_id,
    atualizado_por_nome,
    updated_at
  )
  values (true, 0, 0, 0, 0, actor.utilizador_id, actor.nome, now())
  on conflict (id) do update
  set valor_eventos_anual = 0,
      valor_patrocinios = 0,
      valor_peditorio = 0,
      valor_necessario_agente = 0,
      atualizado_por_id = actor.utilizador_id,
      atualizado_por_nome = actor.nome,
      updated_at = now();

  insert into public.novadis_config (
    id,
    imperial_valor_unitario,
    imperial_valor_tara,
    cidra_valor_unitario,
    cidra_valor_tara,
    sangria_valor_unitario,
    sangria_valor_tara,
    co2_valor_unitario,
    co2_valor_tara,
    atualizado_por_id,
    atualizado_por_nome,
    updated_at
  )
  values (true, 0, 0, 0, 0, 0, 0, 0, 0, actor.utilizador_id, actor.nome, now())
  on conflict (id) do update
  set imperial_valor_unitario = 0,
      imperial_valor_tara = 0,
      cidra_valor_unitario = 0,
      cidra_valor_tara = 0,
      sangria_valor_unitario = 0,
      sangria_valor_tara = 0,
      co2_valor_unitario = 0,
      co2_valor_tara = 0,
      atualizado_por_id = actor.utilizador_id,
      atualizado_por_nome = actor.nome,
      updated_at = now();
end;
$$;

create or replace function public.app_importar_base_dados(
  p_token text,
  p_backup jsonb
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
  payload jsonb;
  next_app_config public.app_config%rowtype;
  next_agente_config public.agente_config%rowtype;
  next_novadis_config public.novadis_config%rowtype;
begin
  select * into actor from public.app_admin_actor(p_token) limit 1;

  if p_backup is null or jsonb_typeof(p_backup) <> 'object' then
    raise exception 'Ficheiro de importação inválido' using errcode = '22023';
  end if;

  payload := coalesce(p_backup -> 'data', p_backup);

  if jsonb_typeof(payload) <> 'object' then
    raise exception 'Ficheiro de importação inválido' using errcode = '22023';
  end if;

  perform public.app_reset_base_dados(p_token);

  if jsonb_typeof(payload -> 'appConfig') = 'object' then
    next_app_config := jsonb_populate_record(null::public.app_config, payload -> 'appConfig');

    insert into public.app_config (
      id,
      favicon_data_url,
      atualizado_por_id,
      atualizado_por_nome,
      created_at,
      updated_at
    )
    values (
      true,
      next_app_config.favicon_data_url,
      actor.utilizador_id,
      actor.nome,
      coalesce(next_app_config.created_at, now()),
      now()
    )
    on conflict (id) do update
    set favicon_data_url = excluded.favicon_data_url,
        atualizado_por_id = actor.utilizador_id,
        atualizado_por_nome = actor.nome,
        updated_at = now();
  end if;

  if jsonb_typeof(payload -> 'agenteConfig') = 'object' then
    next_agente_config := jsonb_populate_record(null::public.agente_config, payload -> 'agenteConfig');

    insert into public.agente_config (
      id,
      valor_eventos_anual,
      valor_patrocinios,
      valor_peditorio,
      valor_necessario_agente,
      atualizado_por_id,
      atualizado_por_nome,
      created_at,
      updated_at
    )
    values (
      true,
      coalesce(next_agente_config.valor_eventos_anual, 0),
      coalesce(next_agente_config.valor_patrocinios, 0),
      coalesce(next_agente_config.valor_peditorio, 0),
      coalesce(next_agente_config.valor_necessario_agente, 0),
      actor.utilizador_id,
      actor.nome,
      coalesce(next_agente_config.created_at, now()),
      now()
    )
    on conflict (id) do update
    set valor_eventos_anual = excluded.valor_eventos_anual,
        valor_patrocinios = excluded.valor_patrocinios,
        valor_peditorio = excluded.valor_peditorio,
        valor_necessario_agente = excluded.valor_necessario_agente,
        atualizado_por_id = actor.utilizador_id,
        atualizado_por_nome = actor.nome,
        updated_at = now();
  end if;

  if jsonb_typeof(payload -> 'novadisConfig') = 'object' then
    next_novadis_config := jsonb_populate_record(null::public.novadis_config, payload -> 'novadisConfig');

    insert into public.novadis_config (
      id,
      imperial_valor_unitario,
      imperial_valor_tara,
      cidra_valor_unitario,
      cidra_valor_tara,
      sangria_valor_unitario,
      sangria_valor_tara,
      co2_valor_unitario,
      co2_valor_tara,
      atualizado_por_id,
      atualizado_por_nome,
      created_at,
      updated_at
    )
    values (
      true,
      coalesce(next_novadis_config.imperial_valor_unitario, 0),
      coalesce(next_novadis_config.imperial_valor_tara, 0),
      coalesce(next_novadis_config.cidra_valor_unitario, 0),
      coalesce(next_novadis_config.cidra_valor_tara, 0),
      coalesce(next_novadis_config.sangria_valor_unitario, 0),
      coalesce(next_novadis_config.sangria_valor_tara, 0),
      coalesce(next_novadis_config.co2_valor_unitario, 0),
      coalesce(next_novadis_config.co2_valor_tara, 0),
      actor.utilizador_id,
      actor.nome,
      coalesce(next_novadis_config.created_at, now()),
      now()
    )
    on conflict (id) do update
    set imperial_valor_unitario = excluded.imperial_valor_unitario,
        imperial_valor_tara = excluded.imperial_valor_tara,
        cidra_valor_unitario = excluded.cidra_valor_unitario,
        cidra_valor_tara = excluded.cidra_valor_tara,
        sangria_valor_unitario = excluded.sangria_valor_unitario,
        sangria_valor_tara = excluded.sangria_valor_tara,
        co2_valor_unitario = excluded.co2_valor_unitario,
        co2_valor_tara = excluded.co2_valor_tara,
        atualizado_por_id = actor.utilizador_id,
        atualizado_por_nome = actor.nome,
        updated_at = now();
  end if;

  insert into public.postos
  select * from jsonb_populate_recordset(null::public.postos, coalesce(payload -> 'postos', '[]'::jsonb));

  insert into public.tipos_despesa
  select * from jsonb_populate_recordset(null::public.tipos_despesa, coalesce(payload -> 'tiposDespesa', '[]'::jsonb));

  insert into public.dias_festa
  select * from jsonb_populate_recordset(null::public.dias_festa, coalesce(payload -> 'diasFesta', '[]'::jsonb));

  insert into public.registos_faturacao
  select * from jsonb_populate_recordset(null::public.registos_faturacao, coalesce(payload -> 'registos', '[]'::jsonb));

  insert into public.despesas_posto
  select * from jsonb_populate_recordset(null::public.despesas_posto, coalesce(payload -> 'despesas', '[]'::jsonb));

  insert into public.pagamentos_agente
  select * from jsonb_populate_recordset(null::public.pagamentos_agente, coalesce(payload -> 'pagamentosAgente', '[]'::jsonb));

  insert into public.novadis_barris
  select * from jsonb_populate_recordset(null::public.novadis_barris, coalesce(payload -> 'novadisBarris', '[]'::jsonb));

  insert into public.novadis_consumos
  select * from jsonb_populate_recordset(null::public.novadis_consumos, coalesce(payload -> 'novadisConsumos', '[]'::jsonb));

  insert into public.tabaqueira_entradas
  select * from jsonb_populate_recordset(null::public.tabaqueira_entradas, coalesce(payload -> 'tabaqueiraEntradas', '[]'::jsonb));

  insert into public.tabaqueira_saidas
  select * from jsonb_populate_recordset(null::public.tabaqueira_saidas, coalesce(payload -> 'tabaqueiraSaidas', '[]'::jsonb));

  insert into public.inventario_tipos_produto
  select * from jsonb_populate_recordset(null::public.inventario_tipos_produto, coalesce(payload -> 'inventarioTipos', '[]'::jsonb));

  insert into public.inventario_produtos
  select * from jsonb_populate_recordset(null::public.inventario_produtos, coalesce(payload -> 'inventarioProdutos', '[]'::jsonb));

  insert into public.anotacoes
  select * from jsonb_populate_recordset(null::public.anotacoes, coalesce(payload -> 'anotacoes', '[]'::jsonb));
end;
$$;

grant execute on function public.app_admin_actor(text) to anon, authenticated;
grant execute on function public.app_exportar_base_dados(text) to anon, authenticated;
grant execute on function public.app_reset_base_dados(text) to anon, authenticated;
grant execute on function public.app_importar_base_dados(text, jsonb) to anon, authenticated;
