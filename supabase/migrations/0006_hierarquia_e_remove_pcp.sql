-- ===================================================================
-- Confirma · Migration 0006
-- Remove perfil 'pcp', adiciona lider_id em usuarios pra hierarquia
-- gestor → consultor
-- ===================================================================

-- 1) Migra qualquer usuário PCP existente pra admin (segurança)
update public.usuarios
   set perfil = 'admin'
 where perfil = 'pcp';

update public.convites
   set perfil = 'admin'
 where perfil = 'pcp';

-- 2) Atualiza check de perfil (agora só 3 perfis)
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'usuarios_perfil_check'
  ) then
    alter table public.usuarios drop constraint usuarios_perfil_check;
  end if;
  alter table public.usuarios
    add constraint usuarios_perfil_check
    check (perfil in ('admin', 'consultor', 'gestor'));

  if exists (
    select 1 from pg_constraint where conname = 'convites_perfil_check'
  ) then
    alter table public.convites drop constraint convites_perfil_check;
  end if;
  alter table public.convites
    add constraint convites_perfil_check
    check (perfil in ('admin', 'consultor', 'gestor'));
end$$;

-- 3) lider_id em usuarios → aponta pro gestor (quando o user é consultor)
alter table public.usuarios
  add column if not exists lider_id uuid
    references public.usuarios(id) on delete set null;

create index if not exists idx_usuarios_lider on public.usuarios(lider_id);

-- 4) lider_id em convites (opcional, quando admin já define o líder no convite)
alter table public.convites
  add column if not exists lider_id uuid
    references public.usuarios(id) on delete set null;
