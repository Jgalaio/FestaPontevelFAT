create extension if not exists pgcrypto;

create table if not exists public.utilizadores (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.registos_faturacao
  add column if not exists criado_por_id uuid references public.utilizadores(id) on delete set null,
  add column if not exists criado_por_nome text,
  add column if not exists atualizado_por_id uuid references public.utilizadores(id) on delete set null,
  add column if not exists atualizado_por_nome text;

create table if not exists public.registos_faturacao_auditoria (
  id uuid primary key default gen_random_uuid(),
  registo_id uuid,
  acao text not null check (acao in ('criado', 'editado', 'apagado')),
  utilizador_id uuid references public.utilizadores(id) on delete set null,
  utilizador_nome text not null default 'Sistema',
  utilizador_email text,
  dados_anteriores jsonb,
  dados_novos jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_registos_faturacao_auditoria_registo
  on public.registos_faturacao_auditoria (registo_id, created_at desc);

create index if not exists idx_registos_faturacao_auditoria_created
  on public.registos_faturacao_auditoria (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_utilizadores_updated_at on public.utilizadores;

create trigger set_utilizadores_updated_at
before update on public.utilizadores
for each row
execute function public.set_updated_at();

create or replace function public.criar_utilizador_por_auth()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.utilizadores (id, email, nome)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'nome', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(new.email, ''),
      'Utilizador'
    )
  )
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.criar_utilizador_por_auth();

create or replace function public.utilizador_atual()
returns table(user_id uuid, user_name text, user_email text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_id uuid := auth.uid();
  actor_name text;
  actor_email text := auth.jwt() ->> 'email';
begin
  if actor_id is not null then
    select u.nome, u.email
    into actor_name, actor_email
    from public.utilizadores u
    where u.id = actor_id;
  end if;

  user_id := actor_id;
  user_name := coalesce(nullif(actor_name, ''), nullif(actor_email, ''), 'Sistema');
  user_email := actor_email;
  return next;
end;
$$;

create or replace function public.aplicar_autoria_registo()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor record;
begin
  select *
  into actor
  from public.utilizador_atual()
  limit 1;

  if tg_op = 'INSERT' then
    new.criado_por_id := coalesce(new.criado_por_id, actor.user_id);
    new.criado_por_nome := coalesce(nullif(new.criado_por_nome, ''), actor.user_name);
    new.atualizado_por_id := coalesce(new.atualizado_por_id, actor.user_id);
    new.atualizado_por_nome := coalesce(nullif(new.atualizado_por_nome, ''), actor.user_name);
    new.updated_at := now();
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.criado_por_id := coalesce(new.criado_por_id, old.criado_por_id);
    new.criado_por_nome := coalesce(nullif(new.criado_por_nome, ''), old.criado_por_nome);
    new.atualizado_por_id := coalesce(actor.user_id, new.atualizado_por_id);
    new.atualizado_por_nome := coalesce(actor.user_name, new.atualizado_por_nome, old.atualizado_por_nome);
    new.updated_at := now();
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists set_registos_faturacao_updated_at on public.registos_faturacao;
drop trigger if exists aplicar_autoria_registo on public.registos_faturacao;

create trigger aplicar_autoria_registo
before insert or update on public.registos_faturacao
for each row
execute function public.aplicar_autoria_registo();

create or replace function public.registar_auditoria_registo()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor record;
begin
  select *
  into actor
  from public.utilizador_atual()
  limit 1;

  if tg_op = 'INSERT' then
    insert into public.registos_faturacao_auditoria (
      registo_id,
      acao,
      utilizador_id,
      utilizador_nome,
      utilizador_email,
      dados_anteriores,
      dados_novos
    )
    values (
      new.id,
      'criado',
      coalesce(new.atualizado_por_id, actor.user_id),
      coalesce(nullif(new.atualizado_por_nome, ''), actor.user_name),
      actor.user_email,
      null,
      to_jsonb(new)
    );

    return new;
  end if;

  if tg_op = 'UPDATE' then
    insert into public.registos_faturacao_auditoria (
      registo_id,
      acao,
      utilizador_id,
      utilizador_nome,
      utilizador_email,
      dados_anteriores,
      dados_novos
    )
    values (
      new.id,
      'editado',
      coalesce(new.atualizado_por_id, actor.user_id),
      coalesce(nullif(new.atualizado_por_nome, ''), actor.user_name),
      actor.user_email,
      to_jsonb(old),
      to_jsonb(new)
    );

    return new;
  end if;

  insert into public.registos_faturacao_auditoria (
    registo_id,
    acao,
    utilizador_id,
    utilizador_nome,
    utilizador_email,
    dados_anteriores,
    dados_novos
  )
  values (
    old.id,
    'apagado',
    actor.user_id,
    actor.user_name,
    actor.user_email,
    to_jsonb(old),
    null
  );

  return old;
end;
$$;

drop trigger if exists registar_auditoria_registo on public.registos_faturacao;

create trigger registar_auditoria_registo
after insert or update or delete on public.registos_faturacao
for each row
execute function public.registar_auditoria_registo();

alter table public.utilizadores enable row level security;
alter table public.registos_faturacao_auditoria enable row level security;

drop policy if exists "Equipa autenticada pode ler utilizadores" on public.utilizadores;
drop policy if exists "Cada utilizador pode criar o seu perfil" on public.utilizadores;
drop policy if exists "Cada utilizador pode editar o seu perfil" on public.utilizadores;

create policy "Equipa autenticada pode ler utilizadores"
on public.utilizadores
for select
to authenticated
using (true);

create policy "Cada utilizador pode criar o seu perfil"
on public.utilizadores
for insert
to authenticated
with check (id = auth.uid());

create policy "Cada utilizador pode editar o seu perfil"
on public.utilizadores
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Equipa autenticada pode ler auditoria" on public.registos_faturacao_auditoria;

create policy "Equipa autenticada pode ler auditoria"
on public.registos_faturacao_auditoria
for select
to authenticated
using (true);
