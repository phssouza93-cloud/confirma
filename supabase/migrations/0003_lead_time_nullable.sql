-- ===================================================================
-- Confirma · Migration 0003
-- Remove o default arbitrário de 20 dias do lead_time_dias.
-- SKUs novos entram com null até que o PCP defina.
-- ===================================================================

alter table public.skus alter column lead_time_dias drop default;

-- Zera os lead times que estavam com o valor default 20 vindo de imports antigos.
-- Comentado por padrão — descomente se quiser zerar todos os 20 já cadastrados:
-- update public.skus set lead_time_dias = null where lead_time_dias = 20;
