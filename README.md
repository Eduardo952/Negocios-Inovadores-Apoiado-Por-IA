# CRONUS — seu espaço de estudos

Aplicação responsiva em HTML, CSS e JavaScript puro, sem dependências, fontes externas ou build.

## Executar

Abra `index.html` em um navegador moderno. Para servir por HTTP, execute `python -m http.server 8080` nesta pasta e acesse `http://localhost:8080`.

- `index.html`: estrutura semântica e onboarding.
- `styles.css`: identidade monocromática, componentes e layouts responsivos.
- `app.js`: timer, tarefas, estatísticas, perfil e persistência.

## Funcionalidades

- Nome pessoal, nome do espaço e áreas de interesse editáveis no botão de perfil.
- Pomodoro de 25 minutos e pausa de 5 minutos, com início, pausa, retomada e reset. O relógio usa o horário de término, mantendo precisão ao trocar de aba ou recarregar. Ao terminar, o próximo ciclo é iniciado manualmente.
- Tarefas com prazo, filtros, conclusão e exclusão. A lista também inclui tarefas futuras e vencidas, identificadas pelo prazo.
- Tempo real de foco acumulado, incluindo sessões parciais; pausas não contam. Reiniciar o relógio preserva o tempo já estudado.
- Ofensiva: cada dia local com pelo menos um minuto de foco conta. A sequência de ontem permanece válida até terminar o dia atual. Indicadores mostram os últimos sete dias.
- Taxa de conclusão calculada sobre todas as tarefas cadastradas. Nenhuma estatística fictícia.
- Sala demonstrativa com exemplos identificados. Mensagens próprias ficam apenas no navegador; não há chat multiusuário ou backend.

Os dados usam a chave `cronus.v1` do `localStorage` e dependem do navegador e da origem. Limpar os dados do site apaga o histórico. Se o armazenamento estiver bloqueado, a aplicação informa e continua em memória. Para persistência consistente, prefira HTTP local ao protocolo `file:`. Outras abas da mesma origem recebem atualizações do estado pelo evento de armazenamento.
