create extension if not exists pgcrypto;

create table if not exists public.postos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  responsavel text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.registos_faturacao (
  id uuid primary key default gen_random_uuid(),
  posto_id uuid not null references public.postos(id) on delete restrict,
  data date not null,
  dinheiro numeric(12, 2) not null default 0 check (dinheiro >= 0),
  multibanco numeric(12, 2) not null default 0 check (multibanco >= 0),
  mbway numeric(12, 2) not null default 0 check (mbway >= 0),
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (posto_id, data)
);

create index if not exists idx_registos_faturacao_data
  on public.registos_faturacao (data);

create index if not exists idx_registos_faturacao_posto_data
  on public.registos_faturacao (posto_id, data);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_registos_faturacao_updated_at on public.registos_faturacao;

create trigger set_registos_faturacao_updated_at
before update on public.registos_faturacao
for each row
execute function public.set_updated_at();

create or replace view public.totais_diarios
with (security_invoker = true)
as
select
  r.data,
  count(*) as postos_registados,
  sum(r.dinheiro) as dinheiro,
  sum(r.multibanco) as multibanco,
  sum(r.mbway) as mbway,
  sum(r.dinheiro + r.multibanco + r.mbway) as total
from public.registos_faturacao r
group by r.data;

alter table public.postos enable row level security;
alter table public.registos_faturacao enable row level security;

drop policy if exists "Equipa autenticada pode ler postos" on public.postos;
drop policy if exists "Equipa autenticada pode criar postos" on public.postos;
drop policy if exists "Equipa autenticada pode editar postos" on public.postos;
drop policy if exists "Equipa autenticada pode apagar postos" on public.postos;

create policy "Equipa autenticada pode ler postos"
on public.postos
for select
to authenticated
using (true);

create policy "Equipa autenticada pode criar postos"
on public.postos
for insert
to authenticated
with check (true);

create policy "Equipa autenticada pode editar postos"
on public.postos
for update
to authenticated
using (true)
with check (true);

create policy "Equipa autenticada pode apagar postos"
on public.postos
for delete
to authenticated
using (true);

drop policy if exists "Equipa autenticada pode ler registos" on public.registos_faturacao;
drop policy if exists "Equipa autenticada pode criar registos" on public.registos_faturacao;
drop policy if exists "Equipa autenticada pode editar registos" on public.registos_faturacao;
drop policy if exists "Equipa autenticada pode apagar registos" on public.registos_faturacao;

create policy "Equipa autenticada pode ler registos"
on public.registos_faturacao
for select
to authenticated
using (true);

create policy "Equipa autenticada pode criar registos"
on public.registos_faturacao
for insert
to authenticated
with check (true);

create policy "Equipa autenticada pode editar registos"
on public.registos_faturacao
for update
to authenticated
using (true)
with check (true);

create policy "Equipa autenticada pode apagar registos"
on public.registos_faturacao
for delete
to authenticated
using (true);

insert into public.postos (nome, responsavel)
values
  ('Bar Central', 'Equipa A'),
  ('Bilheteira', 'Tesouraria'),
  ('Restaurante', 'Equipa B')
on conflict (nome) do nothing;
