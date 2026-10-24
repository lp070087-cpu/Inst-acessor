# 08 — Pagamentos e assinaturas Asaas

Aplicar o AGENTS.md central. Asaas é o gateway oficial. Cuidar de checkout, pedido, recorrência, webhook e concessão/revogação de acesso. Conferir preço/plano no servidor, duplicidade, ordem invertida e autenticação do receptor.

`ASAAS_BASE_URL` pode sobrescrever o ambiente: etiqueta sandbox não garante destino seguro. Nenhuma cobrança, criação de comprador, cancelamento, estorno ou chamada externa sem aprovação específica. Coordenar acesso premium com backend/segurança e schema com banco. Entregar estados e invariantes com testes locais sintéticos, sem dados financeiros reais.
