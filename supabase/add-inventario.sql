create extension if not exists pgcrypto;

create table if not exists public.inventario_tipos_produto (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  criado_por_id uuid references public.utilizadores(id) on delete set null,
  criado_por_nome text,
  atualizado_por_id uuid references public.utilizadores(id) on delete set null,
  atualizado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventario_produtos (
  id uuid primary key default gen_random_uuid(),
  produto text not null,
  tipo_id uuid references public.inventario_tipos_produto(id) on delete set null,
  tipo_nome text not null default 'Sem tipo',
  quantidade_recebida numeric not null default 0 check (quantidade_recebida >= 0),
  quantidade_retirada numeric not null default 0 check (quantidade_retirada >= 0),
  responsavel text not null,
  criado_por_id uuid references public.utilizadores(id) on delete set null,
  criado_por_nome text not null,
  atualizado_por_id uuid references public.utilizadores(id) on delete set null,
  atualizado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventario_produtos_quantidades_check check (quantidade_retirada <= quantidade_recebida)
);

alter table public.inventario_tipos_produto
  add column if not exists nome text not null default '',
  add column if not exists ativo boolean not null default true,
  add column if not exists criado_por_id uuid references public.utilizadores(id) on delete set null,
  add column if not exists criado_por_nome text,
  add column if not exists atualizado_por_id uuid references public.utilizadores(id) on delete set null,
  add column if not exists atualizado_por_nome text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.inventario_produtos
  add column if not exists produto text not null default '',
  add column if not exists tipo_id uuid references public.inventario_tipos_produto(id) on delete set null,
  add column if not exists tipo_nome text not null default 'Sem tipo',
  add column if not exists quantidade_recebida numeric not null default 0,
  add column if not exists quantidade_retirada numeric not null default 0,
  add column if not exists responsavel text not null default '',
  add column if not exists criado_por_id uuid references public.utilizadores(id) on delete set null,
  add column if not exists criado_por_nome text not null default 'Sistema',
  add column if not exists atualizado_por_id uuid references public.utilizadores(id) on delete set null,
  add column if not exists atualizado_por_nome text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventario_produtos_quantidade_recebida_check'
      and conrelid = 'public.inventario_produtos'::regclass
  ) then
    alter table public.inventario_produtos
      add constraint inventario_produtos_quantidade_recebida_check check (quantidade_recebida >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventario_produtos_quantidade_retirada_check'
      and conrelid = 'public.inventario_produtos'::regclass
  ) then
    alter table public.inventario_produtos
      add constraint inventario_produtos_quantidade_retirada_check check (quantidade_retirada >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventario_produtos_quantidades_check'
      and conrelid = 'public.inventario_produtos'::regclass
  ) then
    alter table public.inventario_produtos
      add constraint inventario_produtos_quantidades_check check (quantidade_retirada <= quantidade_recebida);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventario_produtos_tipo_id_fkey'
      and conrelid = 'public.inventario_produtos'::regclass
  ) then
    alter table public.inventario_produtos
      add constraint inventario_produtos_tipo_id_fkey foreign key (tipo_id)
      references public.inventario_tipos_produto(id) on delete set null;
  end if;
end;
$$;

create unique index if not exists inventario_tipos_produto_nome_lower_key
  on public.inventario_tipos_produto (lower(nome));

create index if not exists idx_inventario_produtos_created
  on public.inventario_produtos (created_at desc);

create index if not exists idx_inventario_produtos_tipo
  on public.inventario_produtos (tipo_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_inventario_tipos_updated_at on public.inventario_tipos_produto;
drop trigger if exists set_inventario_produtos_updated_at on public.inventario_produtos;

create trigger set_inventario_tipos_updated_at
before update on public.inventario_tipos_produto
for each row
execute function public.set_updated_at();

create trigger set_inventario_produtos_updated_at
before update on public.inventario_produtos
for each row
execute function public.set_updated_at();

create or replace function public.app_listar_inventario_tipos(p_token text)
returns setof public.inventario_tipos_produto
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
  from public.inventario_tipos_produto
  order by ativo desc, nome asc;
end;
$$;

create or replace function public.app_guardar_inventario_tipo(
  p_token text,
  p_id uuid default null,
  p_nome text default '',
  p_ativo boolean default true
)
returns setof public.inventario_tipos_produto
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
  saved_id uuid;
  normalized_nome text;
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  normalized_nome := regexp_replace(trim(coalesce(p_nome, '')), '[[:space:]]+', ' ', 'g');

  if normalized_nome = '' then
    raise exception 'Indica o nome do tipo de produto' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.inventario_tipos_produto t
    where lower(t.nome) = lower(normalized_nome)
      and (p_id is null or t.id <> p_id)
  ) then
    raise exception 'Esse tipo de produto já existe' using errcode = '23505';
  end if;

  if p_id is null then
    insert into public.inventario_tipos_produto (
      nome,
      ativo,
      criado_por_id,
      criado_por_nome,
      atualizado_por_id,
      atualizado_por_nome
    )
    values (
      normalized_nome,
      coalesce(p_ativo, true),
      actor.utilizador_id,
      actor.nome,
      actor.utilizador_id,
      actor.nome
    )
    returning id into saved_id;
  else
    update public.inventario_tipos_produto
    set nome = normalized_nome,
        ativo = coalesce(p_ativo, true),
        atualizado_por_id = actor.utilizador_id,
        atualizado_por_nome = actor.nome,
        updated_at = now()
    where id = p_id
    returning id into saved_id;
  end if;

  if saved_id is null then
    raise exception 'Tipo de produto não encontrado' using errcode = '02000';
  end if;

  update public.inventario_produtos
  set tipo_nome = normalized_nome,
      updated_at = now()
  where tipo_id = saved_id;

  return query
  select *
  from public.inventario_tipos_produto
  where id = saved_id;
end;
$$;

create or replace function public.app_apagar_inventario_tipo(
  p_token text,
  p_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  if actor.role <> 'admin' then
    raise exception 'Não tem privilégios para apagar tipos de produto' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.inventario_produtos
    where tipo_id = p_id
  ) then
    raise exception 'Este tipo tem produtos associados' using errcode = '23503';
  end if;

  delete from public.inventario_tipos_produto
  where id = p_id;
end;
$$;

create or replace function public.app_listar_inventario_produtos(p_token text)
returns setof public.inventario_produtos
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
  from public.inventario_produtos
  order by created_at desc;
end;
$$;

create or replace function public.app_guardar_inventario_produto(
  p_token text,
  p_id uuid default null,
  p_produto text default '',
  p_tipo_id uuid default null,
  p_quantidade_recebida numeric default 0,
  p_quantidade_retirada numeric default 0,
  p_responsavel text default ''
)
returns setof public.inventario_produtos
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
  existing_produto public.inventario_produtos%rowtype;
  saved_id uuid;
  normalized_produto text;
  normalized_responsavel text;
  tipo_nome_atual text;
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  normalized_produto := regexp_replace(trim(coalesce(p_produto, '')), '[[:space:]]+', ' ', 'g');
  normalized_responsavel := regexp_replace(trim(coalesce(p_responsavel, '')), '[[:space:]]+', ' ', 'g');

  if normalized_produto = '' then
    raise exception 'Indica o produto' using errcode = '22023';
  end if;

  select nome
  into tipo_nome_atual
  from public.inventario_tipos_produto
  where id = p_tipo_id
    and ativo = true
  limit 1;

  if tipo_nome_atual is null then
    raise exception 'Escolhe o tipo de produto' using errcode = '22023';
  end if;

  if coalesce(p_quantidade_recebida, 0) < 0 then
    raise exception 'A quantidade recebida não pode ser negativa' using errcode = '22023';
  end if;

  if normalized_responsavel = '' then
    raise exception 'Indica o responsável' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.inventario_produtos (
      produto,
      tipo_id,
      tipo_nome,
      quantidade_recebida,
      quantidade_retirada,
      responsavel,
      criado_por_id,
      criado_por_nome
    )
    values (
      normalized_produto,
      p_tipo_id,
      tipo_nome_atual,
      coalesce(p_quantidade_recebida, 0),
      0,
      normalized_responsavel,
      actor.utilizador_id,
      actor.nome
    )
    returning id into saved_id;
  else
    select *
    into existing_produto
    from public.inventario_produtos
    where id = p_id
    limit 1;

    if existing_produto.id is null then
      raise exception 'Produto de inventário não encontrado' using errcode = '02000';
    end if;

    if existing_produto.quantidade_retirada > coalesce(p_quantidade_recebida, 0) then
      raise exception 'A quantidade recebida não pode ficar abaixo do que já foi retirado' using errcode = '22023';
    end if;

    update public.inventario_produtos
    set produto = normalized_produto,
        tipo_id = p_tipo_id,
        tipo_nome = tipo_nome_atual,
        quantidade_recebida = coalesce(p_quantidade_recebida, 0),
        responsavel = normalized_responsavel,
        atualizado_por_id = actor.utilizador_id,
        atualizado_por_nome = actor.nome,
        updated_at = now()
    where id = p_id
    returning id into saved_id;
  end if;

  if saved_id is null then
    raise exception 'Produto de inventário não encontrado' using errcode = '02000';
  end if;

  return query
  select *
  from public.inventario_produtos
  where id = saved_id;
end;
$$;

create or replace function public.app_registar_inventario_retirada(
  p_token text,
  p_produto_id uuid,
  p_quantidade numeric default 0,
  p_responsavel text default ''
)
returns setof public.inventario_produtos
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
  produto_atual public.inventario_produtos%rowtype;
  normalized_responsavel text;
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  normalized_responsavel := regexp_replace(trim(coalesce(p_responsavel, '')), '[[:space:]]+', ' ', 'g');

  if coalesce(p_quantidade, 0) <= 0 then
    raise exception 'Indica uma quantidade retirada maior que zero' using errcode = '22023';
  end if;

  if normalized_responsavel = '' then
    raise exception 'Indica o responsável pela retirada' using errcode = '22023';
  end if;

  select *
  into produto_atual
  from public.inventario_produtos
  where id = p_produto_id
  for update;

  if produto_atual.id is null then
    raise exception 'Produto de inventário não encontrado' using errcode = '02000';
  end if;

  if produto_atual.quantidade_retirada + p_quantidade > produto_atual.quantidade_recebida then
    raise exception 'Não existe quantidade suficiente disponível para esse produto' using errcode = '22023';
  end if;

  update public.inventario_produtos
  set quantidade_retirada = quantidade_retirada + p_quantidade,
      responsavel = normalized_responsavel,
      atualizado_por_id = actor.utilizador_id,
      atualizado_por_nome = actor.nome,
      updated_at = now()
  where id = p_produto_id;

  return query
  select *
  from public.inventario_produtos
  where id = p_produto_id;
end;
$$;

create or replace function public.app_apagar_inventario_produto(
  p_token text,
  p_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor record;
begin
  select * into actor from public.app_require_actor(p_token) limit 1;

  if actor.role <> 'admin' then
    raise exception 'Não tem privilégios para apagar dados inseridos' using errcode = '42501';
  end if;

  delete from public.inventario_produtos
  where id = p_id;
end;
$$;

insert into public.inventario_tipos_produto (nome, ativo, criado_por_nome, atualizado_por_nome)
values
  ('Bebidas', true, 'Sistema', 'Sistema'),
  ('Comida', true, 'Sistema', 'Sistema'),
  ('Material', true, 'Sistema', 'Sistema'),
  ('Outros', true, 'Sistema', 'Sistema')
on conflict do nothing;

alter table public.inventario_tipos_produto enable row level security;
alter table public.inventario_produtos enable row level security;

grant execute on all functions in schema public to anon, authenticated;
