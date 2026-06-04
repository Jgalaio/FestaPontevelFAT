# Faturação Pontevel

Sistema web para registo diário da faturação da Festa de Pontével por posto.
Inclui overview global, registo por posto, gestão, Pag.Agente e relatório diário pronto para impressão.

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
3. Executar o ficheiro `supabase/schema.sql`, depois `supabase/add-dias-festa.sql`, `supabase/add-pagamento-despesas.sql`, `supabase/auto-numero-despesas.sql`, `supabase/add-imagem-fatura-despesas.sql` e `supabase/add-pag-agente.sql`.
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
```

Essa atualização cria:

- `utilizadores`, com username, nome, password hash, ativo e papel
- `utilizador_sessoes`, com tokens de sessão temporários
- `dias_festa`, com criação, seleção, fecho e remoção protegida por password
- campos `fat_com_nif` e `tipo_pagamento` em `despesas_posto`
- número de despesa automático por posto/dia e número de fatura editável mesmo por pagar
- imagem opcional da fatura em `despesas_posto`
- `agente_config` e `pagamentos_agente`, com valores-base e entregas ao agente
- campos `criado_por_*` e `atualizado_por_*` em `registos_faturacao`
- `registos_faturacao_auditoria`, com histórico de criar, editar e apagar
- funções RPC para login, faturação, despesas, pagamentos, dias, postos e gestão de utilizadores

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
- `agente_config`: valores Eventos Anual, Patrocínios e Peditório para o Pag.Agente
- `pagamentos_agente`: entregas ao agente com valor, data/hora e utilizador
- `registos_faturacao_auditoria`: histórico de criação, edição e remoção
- `totais_diarios`: vista agregada com totais por dia

Cada posto só pode ter um registo por dia; guardar de novo atualiza o valor desse dia. Quando um dia é fechado, a base de dados bloqueia novas alterações de faturação e despesas para essa data.

## Próximos passos recomendados

- Exportação CSV/PDF por dia
- Página mensal por posto
- Permissões mais finas por papel
- Fecho diário com bloqueio após validação da tesouraria
