# 09 — Testes automatizados

Aplicar o AGENTS.md central. Selecionar verificações proporcionais ao diff. Consultar `package.json`, `bench/safe-run.mjs` e resultados existentes antes de executar; não presumir que um script é seguro apenas pelo nome.

Preferir testes locais de comportamento e invariantes. Integração pode criar banco local e E2E pode iniciar processos: conferir necessidade e permissões antes. Não usar serviços reais nem segredos para suprir fixtures. Reservar arquivos de testes separados dos arquivos de implementação. Entregar comandos, resultados e o que não foi verificado; não repetir suíte inteira sem motivo.
