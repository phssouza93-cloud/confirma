-- ===================================================================
-- Confirma · Migration 0004
-- Flag de serviço em skus + SKUs especiais de serviço + aliases finais
-- (consolida cabos, capa, armários, estojo, kit, carrinho e serviços)
-- ===================================================================

-- 1) Adiciona coluna eh_servico em skus
alter table public.skus
  add column if not exists eh_servico boolean default false;

-- 2) Cria SKUs especiais para itens que são serviço (não produto físico)
--    O motor de prazo vai pular esses no cálculo do gargalo.
insert into public.skus (codigo, descricao, familia, eh_servico, ativo)
values
  ('SVC0001', 'Mensalidade de Locação', 'SVC', true, true),
  ('SVC0002', 'Serviço de Instrumentação', 'SVC', true, true)
on conflict (codigo) do update
  set descricao = excluded.descricao,
      eh_servico = excluded.eh_servico;

-- 3) Insere/atualiza todos os aliases finais
insert into public.sku_aliases (descricao_alias, sku_codigo, derivacao) values
  -- cabos de fibra
  ($$CABO DE FIBRA 2,5m - CONFIANCE$$, 'CBF0015', null),
  ($$CABO DE FIBRA 2,5m - INNOVA$$, 'INO0002', null),
  ($$CABO DE FIBRA 2,5m FLUORESCÊNCIA - CONFIANCE$$, 'OTC0003', null),
  -- capa
  ($$CAPA DE PROTEÇÃO 32''$$, 'DIV0254', null),
  -- armários e acessórios
  ($$ARMÁRIO PEQUENO FECHADO 32"$$, 'CAR0010', null),
  ($$ARMÁRIO PEQUENO FECHADO 42"$$, 'CAR0010', null),
  ($$ARMÁRIO GRANDE FECHADO$$, 'CAR0009', null),
  ($$ESTOJO PARA ESTERILIZAÇÃO$$, 'HNS0003', null),
  ($$KIT INSTRUMENTAIS SICONV - VALOR PARA ESTIMATIVA$$, 'BHI9999', null),
  ($$CARRINHO PARA STATION21 / 27$$, 'CAR0012', null),
  -- serviços
  ($$Mensalidade de Locação$$, 'SVC0001', null),
  ($$Serviço Instrumentação$$, 'SVC0002', null)
on conflict (descricao_alias) do update
  set sku_codigo = excluded.sku_codigo,
      derivacao = excluded.derivacao,
      updated_at = now();
