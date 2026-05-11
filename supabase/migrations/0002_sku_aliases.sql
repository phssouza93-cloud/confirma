-- ===================================================================
-- Confirma · Migration 0002
-- Tabela de aliases: descrição livre → SKU (+ derivação preferida)
-- ===================================================================

create table if not exists public.sku_aliases (
  id uuid primary key default gen_random_uuid(),
  descricao_alias text not null,
  sku_codigo text not null,
  derivacao text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists idx_aliases_descricao
  on public.sku_aliases(descricao_alias);
create index if not exists idx_aliases_sku
  on public.sku_aliases(sku_codigo);

alter table public.sku_aliases enable row level security;

drop policy if exists "Auth leem aliases" on public.sku_aliases;
create policy "Auth leem aliases" on public.sku_aliases
  for select using (auth.uid() is not null);

drop policy if exists "Auth inserem aliases" on public.sku_aliases;
create policy "Auth inserem aliases" on public.sku_aliases
  for insert with check (auth.uid() is not null);

drop policy if exists "Auth atualizam aliases" on public.sku_aliases;
create policy "Auth atualizam aliases" on public.sku_aliases
  for update using (auth.uid() is not null);

drop policy if exists "Auth deletam aliases" on public.sku_aliases;
create policy "Auth deletam aliases" on public.sku_aliases
  for delete using (auth.uid() is not null);

-- updated_at automático
drop trigger if exists trg_aliases_updated_at on public.sku_aliases;
create trigger trg_aliases_updated_at before update on public.sku_aliases
  for each row execute function public.set_updated_at();

-- ===================================================================
-- Aliases iniciais (16) — corrigem fuzzy matching errado das oportunidades
-- ===================================================================
insert into public.sku_aliases (descricao_alias, sku_codigo, derivacao) values
  ('MONITOR  LED  GRAU  MÉDICO  32"  ULTRA HD 4K', 'MNT0017', null),
  ('MONITOR  LED  GRAU  MÉDICO  42"  ULTRA HD 4K  16x10', 'MNT0019', null),
  ('MICROCÂMERA DIGITAL SCAM3 4K COM GRAVAÇÃO', 'CAM0004', null),
  ('MICROCÂMERA DIGITAL SCAM 4K COM GRAVAÇÃO', 'CAM0006', null),
  ('MICROCÂMERA DIGITAL SCAM 4K COM GRAVAÇÃO E FLUORESCÊNCIA', 'CAM0006', null),
  ('FONTE DE LUZ CM-LED', 'FNT0001', '001'),
  ('FONTE DE LUZ CM-LED COM FLUORESCÊNCIA', 'FNT0001', '002'),
  ('INSUFLADOR ELETRÔNICO DE CO2 40L - LAPAROSCOPIA', 'INS0002', null),
  ('ENDOSCÓPIO RÍGIDO 10mm x 330mm 30° 4K CM-OTC0051L - LAPAROSCÓPIO – CONFIANCE', 'LAP0017', null),
  ('ENDOSCÓPIO RÍGIDO 10mm x 330mm 30° NIR CM-OTC0066L - LAPAROSCÓPIO – CONFIANCE', 'LAP0029', null),
  ('ENDOSCÓPIO RÍGIDO 4mm x 175mm 30° Full HD CM-OTC0011A ARTROSCÓPIO – CONFIANCE', 'ART0002', null),
  ('ENDOSCÓPIO RÍGIDO 4mm x 302mm 30° Full HD CM-OTC0028H - HISTEROSCÓPIO – CONFIANCE', 'HIS0003', null),
  ('ENDOSCÓPIO RÍGIDO 4mm x 302mm 30° Full HD CM-OTC0028C - CISTOSCÓPIO – CONFIANCE', 'CIS0003', null),
  ('INATIVO ENDOSCÓPIO RÍGIDO 2.9mm x 302mm 30° 4K CM-OTC0033H HISTEROSCÓPIO – CONFIANCE', 'HIS0008', null),
  ('CM-STATION 4k', 'STB0001', '003'),
  ('CM-STATION27', 'SIC0002', null),
  ('MANGUEIRA CILINDRO ENGATE RÁPIDO 1,5m', 'ACE0020', null)
on conflict (descricao_alias) do update
  set sku_codigo = excluded.sku_codigo,
      derivacao = excluded.derivacao,
      updated_at = now();
