-- ===================================================================
-- Confirma · Migration 0005
-- Tabela de convites + reforço de políticas
-- ===================================================================

-- 1) Tabela de convites
create table if not exists public.convites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  nome text not null,
  perfil text not null
    check (perfil in ('admin', 'pcp', 'consultor', 'gestor')),
  token text not null unique,
  criado_por uuid references public.usuarios(id) on delete set null,
  criado_em timestamptz default now(),
  expira_em timestamptz default (now() + interval '7 days'),
  usado_em timestamptz,
  usado_por uuid references public.usuarios(id) on delete set null
);

create index if not exists idx_convites_email on public.convites(email);
create index if not exists idx_convites_token on public.convites(token);

-- 2) RLS em convites:
--    - leitura pública (a página /convite/[token] precisa ler pelo token,
--      o secret é o próprio token de 32 bytes)
--    - escrita só pra admin via service role (a app usa service role nos
--      server actions de criar/apagar convite)
alter table public.convites enable row level security;

drop policy if exists "convites_select_all" on public.convites;
create policy "convites_select_all" on public.convites
  for select using (true);

-- service_role bypassa RLS, então não precisa de policy de write

-- 3) Policies de escrita para admin (faltavam na versão original)
drop policy if exists "convites_admin_insert" on public.convites;
create policy "convites_admin_insert" on public.convites
  for insert with check (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.perfil = 'admin'
    )
  );

drop policy if exists "convites_admin_update" on public.convites;
create policy "convites_admin_update" on public.convites
  for update using (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.perfil = 'admin'
    )
  );

drop policy if exists "convites_admin_delete" on public.convites;
create policy "convites_admin_delete" on public.convites
  for delete using (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.perfil = 'admin'
    )
  );
