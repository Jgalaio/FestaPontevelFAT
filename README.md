# Faturação Pontevel

Sistema web para registo diário da faturação da Festa de Pontével por posto.
Inclui overview global, registo por posto, gestão, Pag.Agente, Notas, Stocks com Novadis, Tabaqueira, Inventário e relatório diário pronto para impressão.

## Stack

- Next.js para a app web
- Supabase para base de dados e login por username/password
- Vercel para deploy
- GitHub para versionamento e ligação ao Vercel

## Arranque local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Sem variáveis Supabase, a app abre em modo de demonstração e guarda dados no `localStorage`.

## Supabase

1. Criar um projeto no Supabase.
2. Abrir `SQL Editor`.
3. Executar o ficheiro `supabase/schema.sql`, depois `supabase/add-dias-festa.sql`, `supabase/add-pagamento-despesas.sql`, `supabase/auto-numero-despesas.sql`, `supabase/add-imagem-fatura-despesas.sql`, `supabase/add-pag-agente.sql`, `supabase/admin-delete-guard.sql`, `supabase/add-novadis.sql`, `supabase/add-tabaqueira.sql`, `supabase/add-inventario.sql` e `supabase/add-anotacoes.sql`.
4. Copiar `Project URL` e a `publishable key`.

Depois preencher:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Se o teu projeto Supabase mostrar a chave antiga `anon public key`, podes usar `NEXT_PUBLIC_SUPABASE_ANON_KEY` em vez de `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

O login é feito por funções RPC da base de dados. As passwords ficam guardadas com hash `crypt`, não em texto simples.

### Atualizar uma base de dados já criada

Se já tinhas corrido um schema anterior, executa no `SQL Editor` o ficheiro:

```bash
supabase/add-login-username-password.sql
supabase/add-dias-festa.sql
supabase/add-pagamento-despesas.sql
supabase/auto-numero-despesas.sql
supabase/add-imagem-fatura-despesas.sql
supabase/add-pag-agente.sql
supabase/admin-delete-guard.sql
supabase/add-novadis.sql
supabase/add-tabaqueira.sql
supabase/add-inventario.sql
supabase/add-anotacoes.sql
```

Essa atualização cria:

- `utilizadores`, com username, nome, password hash, ativo e papel
- `utilizador_sessoes`, com tokens de sessão temporários
- `dias_festa`, com criação, seleção, fecho e remoção protegida por password
- campos `fat_com_nif` e `tipo_pagamento` em `despesas_posto`
- número de despesa automático por posto/dia e número de fatura editável mesmo por pagar
- imagem opcional da fatura em `despesas_posto`
- `agente_config` e `pagamentos_agente`, com valor necessário, valores-base e entregas ao agente
- proteção para apagar faturação/despesas apenas com papel `admin`
- `novadis_config`, `novadis_barris` e `novadis_consumos`, com valor unitário/tara por tipo, histórico recebido e gasto diário
- `tabaqueira_entradas` e `tabaqueira_saidas`, com stock recebido, preço fornecedor, PVP, saídas por dia/posto e correções de admin
- `inventario_tipos_produto` e `inventario_produtos`, com tipos, produto, quantidades recebidas/retiradas e responsável
- `anotacoes`, com notas partilhadas, criador e última alteração
- campos `criado_por_*` e `atualizado_por_*` em `registos_faturacao`
- `registos_faturacao_auditoria`, com histórico de criar, editar e apagar
- funções RPC para login, faturação, despesas, pagamentos, dias, postos, stocks e gestão de utilizadores

Utilizadores iniciais:

- `Jgalaio`
- `ALopes`

Na app, a aba `Utilizadores` permite criar e editar users, incluindo trocar password, ativar/desativar e definir o papel. Essa gestão fica reservada a utilizadores com papel `admin`.

## Vercel

1. Criar o repositório no GitHub.
2. Fazer push deste projeto.
3. Importar o repositório na Vercel.
4. Adicionar as duas variáveis Supabase nas `Environment Variables`.
5. Fazer deploy.

## GitHub

Este projeto já foi inicializado com Git localmente. Para publicar num repositório GitHub:

```bash
git remote add origin git@github.com:UTILIZADOR/faturacao-pontevel.git
git push -u origin main
```

## Modelo de dados

- `postos`: nome, responsável, estado ativo
- `utilizadores`: username, nome, password hash, estado ativo, papel
- `utilizador_sessoes`: sessões temporárias de login
- `dias_festa`: dias selecionáveis da festa, com estado aberto/fechado
- `registos_faturacao`: posto, data, dinheiro, multibanco, MB Way, observações, criado por, atualizado por
- `despesas_posto`: posto, data, tipo, número automático, valor, FAT com NIF, tipo de pagamento, estado/número/imagem da fatura
- `agente_config`: valor necessário ao agente, Eventos Anual, Patrocínios e Peditório para o Pag.Agente
- `pagamentos_agente`: entregas ao agente com valor, data/hora e utilizador
- `novadis_config`: valor unitário e valor de tara para Imperial, Cidra, Sangria e Garrafas de CO2, editáveis apenas por `admin`
- `novadis_barris`: registos Novadis recebidos, tipo, quantidade, data/hora e utilizador
- `novadis_consumos`: gastos Novadis por dia, tipo, quantidade, data/hora e utilizador
- `tabaqueira_entradas`: marca, quantidade recebida, preço fornecedor, PVP, data/hora e utilizador
- `tabaqueira_saidas`: dia da festa, marca, quantidade saída, quem levou, posto de destino, edição justificada e utilizadores envolvidos
- `inventario_tipos_produto`: tipos de produto usados no inventário
- `inventario_produtos`: produto, tipo, quantidades recebidas/retiradas, responsável e utilizadores envolvidos
- `anotacoes`: título, texto, criador e última alteração
- `registos_faturacao_auditoria`: histórico de criação, edição e remoção
- `totais_diarios`: vista agregada com totais por dia

Cada posto só pode ter um registo por dia; guardar de novo atualiza o valor desse dia. Quando um dia é fechado, a base de dados bloqueia novas alterações de faturação e despesas para essa data.

Os valores da Novadis são apresentados em `Stocks > Novadis` e não entram nos totais da festa. Na consignação, as unidades cheias a devolver contam pelo valor unitário e as unidades gastas/vazias contam pelo valor da tara. O resumo de consignação permite editar o total gasto por produto para corrigir enganos de lançamento.

A Tabaqueira fica em `Stocks > Tabaqueira`. Permite registar receções por marca, quantidade, preço fornecedor e PVP, e controlar saídas por dia da festa, marca, pessoa que levou e posto de destino. Apenas utilizadores `admin` podem corrigir ou apagar receções; saídas podem ser editadas com justificação e apagadas por `admin`.

O Inventário fica em `Stocks > Inventário`. Tem as abas `Inserir/Consulta` e `Tipos/Criação`: na primeira registas produtos recebidos, consultas stock e fazes retiradas escolhendo o produto e a quantidade; na segunda crias e editas tipos de produto. Produtos podem ser corrigidos pela equipa e apagados por `admin`.

As Notas ficam no topo da app. O botão `Notas` abre as primeiras 5 anotações e permite adicionar, editar, apagar e abrir a página completa em `/anotacoes`.

## Próximos passos recomendados

- Exportação CSV/PDF por dia
- Página mensal por posto
- Permissões mais finas por papel
- Fecho diário com bloqueio após validação da tesouraria
