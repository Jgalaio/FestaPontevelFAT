# Faturação Pontevel

Sistema web para registo diário da faturação da Festa de Pontével por posto.

## Stack

- Next.js para a app web
- Supabase para base de dados e autenticação por email
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
3. Executar o ficheiro `supabase/schema.sql`.
4. Em `Authentication > Providers`, confirmar que o login por email está ativo.
5. Copiar `Project URL` e `anon public key`.

Depois preencher:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

As regras RLS do MVP permitem leitura e escrita a utilizadores autenticados. Para produção, o próximo passo natural é separar permissões por papel, por exemplo `tesouraria`, `responsavel_posto` e `consulta`.

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
- `registos_faturacao`: posto, data, dinheiro, multibanco, MB Way, observações
- `totais_diarios`: vista agregada com totais por dia

Cada posto só pode ter um registo por dia; guardar de novo atualiza o valor desse dia.

## Próximos passos recomendados

- Exportação CSV/PDF por dia
- Página mensal por posto
- Papéis/permissões por utilizador
- Histórico de alterações
- Fecho diário com bloqueio após validação da tesouraria
