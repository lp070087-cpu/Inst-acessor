# Prévia mobile local isolada

Na raiz `.audit-worktree`, branch `audit/finalizacao-inst-acessor`, execute:

```powershell
node bench/demo-dev.mjs
```

Alias equivalente: `npm run dev:demo`.

Após o Next informar que está pronto, abra `http://127.0.0.1:3107/demo/dashboard`.
As telas demonstrativas incluem dashboard, calendário, publicações e integrações, com dados fictícios e ações simuladas. Não representam contas conectadas ou persistência real.

O launcher verifica worktree, branch e porta antes de iniciar. Não encerra processos existentes. Escuta apenas em `127.0.0.1`; usa `.next-demo`, ambiente de sistema limitado, segredos fictícios, banco inutilizável em loopback e worker desativado. Não carrega credenciais do shell nem arquivos `.env*`. Não use `npm run dev` para substituir esse comando na prévia isolada.

O preload bloqueia sockets e fetch fora de loopback no processo Node e filhos que herdam `NODE_OPTIONS`, além de ocultar `.env*` do carregador Next. A inspeção local de `@next/env` confirmou que `__NEXT_PROCESSED_ENV=true` sozinho evita parsing, mas ainda lê arquivos; por isso a proteção de filesystem também é aplicada. São controles locais deste launcher, não um firewall do sistema. O navegador deve usar somente recursos locais das telas demonstrativas.

## VS Code

`Ctrl+Shift+P` → **Simple Browser: Show** → cole o endereço acima. Mova a aba para uma coluna ao lado do código. Ajuste sua largura para aproximar um celular; o Simple Browser não oferece emulação precisa de dispositivo. Salvar os arquivos atualiza a tela pelo Fast Refresh do Next.

## Chrome

Abra o endereço, pressione `F12` e `Ctrl+Shift+M`. Selecione **Responsive**, altura `844`, e teste larguras **320, 360, 390 e 412 px**, zoom 100%. Confira navegação, botões e ausência de rolagem horizontal. O login e APIs reais não recebem bypass de autenticação. A demonstração deve retornar 404 fora de desenvolvimento local autorizado; não usar para publicar Preview.

Pare o processo com `Ctrl+C` no terminal que o iniciou. Nenhum deploy, migração, banco ou serviço externo é necessário.
