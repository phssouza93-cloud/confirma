-- ===================================================================
-- Confirma · Schema inicial
-- Confiance Medical
-- Migration: 0001_initial_schema
-- ===================================================================

-- ===================================================================
-- TABELAS
-- ===================================================================

-- Perfis estendidos (linkados a auth.users do Supabase Auth)
create table if not exists public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null unique,
  perfil text not null default 'consultor'
    check (perfil in ('admin', 'gestor', 'pcp', 'consultor')),
  ativo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Cadastro mestre de SKUs
create table if not exists public.skus (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  descricao text not null,
  familia text,
  lead_time_dias int default 20,
  estoque int default 0,
  preco_tabela numeric(12,2),
  ativo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Estoque por derivação (granularidade fina)
create table if not exists public.estoque_derivacoes (
  id uuid primary key default gen_random_uuid(),
  sku_id uuid references public.skus(id) on delete cascade,
  derivacao text,
  qtd_disponivel int default 0,
  deposito text default 'EP',
  atualizado_em timestamptz default now()
);

-- Oportunidades (pipeline)
create table if not exists public.oportunidades (
  id uuid primary key default gen_random_uuid(),
  cliente text not null,
  nome text,
  valor numeric(14,2) default 0,
  fase text default 'POC (demonstração)',
  record_type text default 'Vendas Privadas',
  data_fechamento date,
  owner text,
  gestor_regional text,
  regiao text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Itens das oportunidades
create table if not exists public.oportunidade_itens (
  id uuid primary key default gen_random_uuid(),
  oportunidade_id uuid references public.oportunidades(id) on delete cascade,
  sku_codigo text,
  sku_id uuid references public.skus(id),
  derivacao text,
  descricao text,
  quantidade numeric(10,2) default 1,
  preco_unitario numeric(12,2) default 0,
  total numeric(14,2) default 0
);

-- WIP (Em andamento)
create table if not exists public.wip (
  id uuid primary key default gen_random_uuid(),
  op_numero text not null unique,
  sku_codigo text not null,
  sku_id uuid references public.skus(id),
  derivacao text,
  qtd_prevista int default 1,
  data_prevista date,
  status text default 'aguardando_data'
    check (status in ('aguardando_data', 'em_producao', 'atrasada')),
  atualizado_em timestamptz default now()
);

-- Carteira de Pedidos
create table if not exists public.carteira_pedidos (
  id uuid primary key default gen_random_uuid(),
  numero_pedido text not null,
  cliente text not null,
  sku_codigo text not null,
  sku_id uuid references public.skus(id),
  derivacao text,
  quantidade int default 1,
  data_promessa date,
  status text default 'em_producao'
    check (status in ('em_producao', 'aguardando_liberacao', 'liberado')),
  oportunidade_origem_id uuid references public.oportunidades(id) on delete set null,
  sem_cadastro boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Histórico de promessas (auditoria)
create table if not exists public.promessas (
  id uuid primary key default gen_random_uuid(),
  oportunidade_id uuid references public.oportunidades(id) on delete cascade,
  prazo_dias int,
  calculado_em timestamptz default now(),
  consultor_id uuid references public.usuarios(id),
  detalhe_calculo jsonb,
  aprovador_id uuid references public.usuarios(id),
  observacoes text
);

-- ===================================================================
-- ÍNDICES
-- ===================================================================
create index if not exists idx_skus_codigo on public.skus(codigo);
create index if not exists idx_skus_familia on public.skus(familia);
create index if not exists idx_estoque_sku on public.estoque_derivacoes(sku_id);
create index if not exists idx_oportunidades_fase on public.oportunidades(fase);
create index if not exists idx_oportunidades_owner on public.oportunidades(owner);
create index if not exists idx_itens_opp on public.oportunidade_itens(oportunidade_id);
create index if not exists idx_wip_sku on public.wip(sku_codigo);
create index if not exists idx_wip_data on public.wip(data_prevista);
create index if not exists idx_carteira_sku on public.carteira_pedidos(sku_codigo);
create index if not exists idx_carteira_status on public.carteira_pedidos(status);

-- ===================================================================
-- TRIGGERS de updated_at
-- ===================================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_usuarios_updated_at on public.usuarios;
create trigger trg_usuarios_updated_at before update on public.usuarios
  for each row execute function public.set_updated_at();

drop trigger if exists trg_skus_updated_at on public.skus;
create trigger trg_skus_updated_at before update on public.skus
  for each row execute function public.set_updated_at();

drop trigger if exists trg_oportunidades_updated_at on public.oportunidades;
create trigger trg_oportunidades_updated_at before update on public.oportunidades
  for each row execute function public.set_updated_at();

drop trigger if exists trg_carteira_updated_at on public.carteira_pedidos;
create trigger trg_carteira_updated_at before update on public.carteira_pedidos
  for each row execute function public.set_updated_at();

-- ===================================================================
-- ROW LEVEL SECURITY
-- ===================================================================
alter table public.usuarios enable row level security;
alter table public.skus enable row level security;
alter table public.estoque_derivacoes enable row level security;
alter table public.oportunidades enable row level security;
alter table public.oportunidade_itens enable row level security;
alter table public.wip enable row level security;
alter table public.carteira_pedidos enable row level security;
alter table public.promessas enable row level security;

-- Políticas MVP: qualquer usuário autenticado pode ler/escrever
-- (refinaremos por perfil em uma migration futura)

-- usuarios
drop policy if exists "Usuarios autenticados leem usuarios" on public.usuarios;
create policy "Usuarios autenticados leem usuarios" on public.usuarios
  for select using (auth.uid() is not null);

drop policy if exists "Usuario edita proprio perfil" on public.usuarios;
create policy "Usuario edita proprio perfil" on public.usuarios
  for update using (auth.uid() = id);

-- macro de policies para tabelas operacionais
do $$
declare
  tbl text;
begin
  for tbl in
    select unnest(array[
      'skus', 'estoque_derivacoes', 'oportunidades', 'oportunidade_itens',
      'wip', 'carteira_pedidos', 'promessas'
    ])
  loop
    execute format('drop policy if exists "Auth leem %I" on public.%I', tbl, tbl);
    execute format('create policy "Auth leem %I" on public.%I for select using (auth.uid() is not null)', tbl, tbl);
    execute format('drop policy if exists "Auth inserem %I" on public.%I', tbl, tbl);
    execute format('create policy "Auth inserem %I" on public.%I for insert with check (auth.uid() is not null)', tbl, tbl);
    execute format('drop policy if exists "Auth atualizam %I" on public.%I', tbl, tbl);
    execute format('create policy "Auth atualizam %I" on public.%I for update using (auth.uid() is not null)', tbl, tbl);
    execute format('drop policy if exists "Auth deletam %I" on public.%I', tbl, tbl);
    execute format('create policy "Auth deletam %I" on public.%I for delete using (auth.uid() is not null)', tbl, tbl);
  end loop;
end $$;

-- ===================================================================
-- TRIGGER: cria perfil automaticamente após cadastro no Auth
-- Primeiro usuário cadastrado vira admin; demais ficam como consultor
-- ===================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  qtd_usuarios int;
begin
  select count(*) into qtd_usuarios from public.usuarios;
  insert into public.usuarios (id, nome, email, perfil)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email,
    case when qtd_usuarios = 0 then 'admin' else 'consultor' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
