# Prateleira

Sistema local de estoque para pequenos mercados, feito com HTML, CSS e módulos JavaScript, sem framework e sem dependências de produção.

## Executar

Requer um navegador moderno com IndexedDB e suporte a `<dialog>`. Sirva a pasta por HTTP; não abra o HTML diretamente com `file://`, pois os módulos JavaScript exigem um servidor.

Com Node.js 22 ou superior:

```sh
cd prateleira
node server.js
```

Abra **http://127.0.0.1:8080**. O servidor não precisa de `npm install` e escuta apenas no computador local.

Alternativa com Python, dentro de `prateleira`:

```sh
python -m http.server 8080 --bind 127.0.0.1
```

Use sempre o mesmo endereço e porta: `localhost` e `127.0.0.1` são origens diferentes e têm bancos separados.

## Primeiro uso

1. Em **Configurações**, informe o nome do mercado e cadastre categorias e fornecedores.
2. Em **Produtos**, cadastre os itens e seus saldos iniciais.
3. Em **Estoque**, registre entradas, saídas ou ajustes de contagem.
4. Em **Reposição**, monte a lista e registre recebimentos totais ou parciais.

Para explorar, use **Configurações → Carregar exemplo**. Os dados demonstrativos são opcionais e exigem confirmação, pois substituem o banco atual. A aplicação começa vazia.

## Páginas e recursos

- **Visão geral:** indicadores reais, prioridades de reposição, gráfico por período e operações recentes.
- **Produtos:** cadastro completo, edição, detalhes, busca por nome/SKU sem distinção de acentos, filtros, ordenação, paginação, arquivamento e restauração.
- **Estoque:** saldo atual, limites, situação e movimentos com prévia do saldo resultante.
- **Movimentações:** registros permanentes com produto, tipo, quantidade, saldo anterior/posterior, data e motivo; filtros e CSV.
- **Reposição:** separação entre esgotados e abaixo do mínimo, sugestões até o máximo desejado, lista ajustável, exportação e recebimentos parciais.
- **Relatórios:** entradas/saídas a custo, produtos com mais/menos operações, última movimentação, valores por categoria e excessos. Períodos de 7, 30 e 90 dias e CSV.
- **Configurações:** mercado, categorias, fornecedores, temas claro/escuro/sistema, backup JSON e restauração validada.

## Regras de integridade

- Estoque esgotado: saldo zero. Baixo: saldo positivo abaixo do mínimo. Excesso: saldo superior ao máximo. Os demais são normais.
- Reposição sugerida: `max(0, máximo - saldo)`. Quantidade pendente da lista pode ser alterada independentemente da sugestão.
- `un`, `cx` e `pct` usam números inteiros; `kg` e `l` aceitam até três casas decimais. Preços aceitam duas casas.
- Saídas maiores que o saldo, quantidades negativas, SKU duplicado e limites inválidos são recusados.
- Saldo inicial gera um ajuste no histórico. Editar o cadastro não altera saldos; trocar unidade após o cadastro é bloqueado.
- Ajustes recebem o **novo saldo contado**. O histórico registra a diferença assinada entre antes e depois.
- Produtos só podem ser arquivados com saldo zero e sem compras pendentes. Permanecem disponíveis no histórico e podem ser restaurados. Não há exclusão de produtos com histórico.
- Categorias e fornecedores vinculados a produtos, inclusive arquivados, não podem ser excluídos.
- Recebimentos gravam entrada, novo saldo e quantidade recebida numa única transação IndexedDB. Falhas abortam todas as alterações relacionadas. Transações concorrentes são serializadas pelo banco.
- Relatórios de giro contam entradas e saídas, excluindo ajustes. Valores históricos usam o custo de cada operação. Estoque e excesso usam o custo atual, não preço de venda.
- Totais de quantidades agregam unidades diferentes e são identificados como tal; consulte cada produto para decisões de compra.
- Importação confere referências, unicidade, tipos, sequência e encadeamento completo dos saldos antes de substituir o banco. Limite de arquivo: 20 MB.

## Organização

```text
index.html                  Estrutura da aplicação
assets/icons/               Marca SVG local
assets/fonts/               Manrope variável e licença SIL Open Font License
css/variables.css           Paleta, temas, tipografia e tokens de movimento
css/layout.css              Navegação e estrutura
css/components.css          Formulários, tabelas, modais e notificações
css/pages.css               Composição das páginas
css/animations.css          Linguagem de movimento e redução de animações
css/responsive.css          Adaptação a tablets e smartphones
js/core/storage.js          IndexedDB e transações
js/core/state.js            Estado da interface e comunicação entre abas
js/core/router.js           Rotas por hash
js/services/                Regras de produtos, estoque, relatórios e backup
js/components/              Componentes visuais compartilhados
js/pages/                   As sete páginas
js/utils/                   Validação, escape, formatos e exportação
tests/                      Testes de regras, persistência e interface
server.js                   Servidor HTTP local, sem instalação
```

Os serviços dependem da camada de persistência, não do DOM. Uma futura API pode substituir essa camada e oferecer as mesmas operações transacionais no servidor. Não há servidor de dados, autenticação ou sincronização entre dispositivos nesta versão. Atualizações entre abas da mesma origem usam BroadcastChannel.

## Dados e backups

O banco `prateleira-v1` tem os object stores `products`, `categories`, `suppliers`, `movements`, `purchases` e `settings`. Somente a preferência de tema usa localStorage. Recarregar a página ou reabrir o navegador mantém os registros; limpar dados do site, usar navegação privada ou remover o perfil do navegador pode apagá-los. Exporte backups regularmente.

Dados digitados são escapados ao renderizar. CSV usa UTF-8 com BOM, separador ponto e vírgula, aspas e proteção contra interpretação de fórmulas. Não há requisições externas durante o uso.

## Testes

As dependências abaixo são usadas apenas nos testes:

```sh
npm ci
npm test
```

No PowerShell com scripts desabilitados, use `npm.cmd ci` e `npm.cmd test`.

Os testes de serviço usam fake-indexeddb para verificar transações, concorrência, rejeição sem alterações parciais, recebimentos, importação/exportação e reabertura da conexão. Os testes de interface usam jsdom com os módulos reais para exercitar navegação, formulários, erros preservando valores, filtros, paginação, cadastro seguro, movimentos, arquivamento, listas, temas e downloads.

A suíte DOM não substitui uma inspeção visual em navegador real. A revisão visual automatizada foi bloqueada pelo ambiente de Computer Use, que não conseguiu identificar com segurança a URL atual no Windows. O servidor local e os arquivos foram verificados por HTTP; não houve validação visual final em dispositivos físicos.

## Acessibilidade e movimento

Navegação por teclado, link para pular ao conteúdo, labels, estados de erro, tabelas com cabeçalhos, alternativas tabulares aos gráficos, modais nativos com Escape e retorno de foco. Estados usam textos além de cores. O menu recolhe em telas pequenas e tabelas mantêm rolagem horizontal. Animações curtas usam tokens compartilhados e respeitam `prefers-reduced-motion`.
