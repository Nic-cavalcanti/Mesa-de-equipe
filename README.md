# Mesa da Equipe

Prototipo de software de gestao operacional orientado a clientes, pronto para deploy na Vercel e preparado para usar Supabase como banco de dados.

A proposta central e gerenciar a situacao do cliente. Assim fica mais natural acompanhar bloqueios como:

- Segura entrega
- Nao emite nota fiscal
- Solicita limite
- Pendencias comerciais, fiscais, financeiras e logisticas

## Estrutura

```
.
├── index.html
├── package.json
├── vercel.json
├── .env.example
├── src/
│   ├── main.jsx
│   ├── data.js
│   ├── styles.css
│   ├── lib/supabase.js
│   └── services/clientRepository.js
├── supabase/
│   └── schema.sql
└── README.md
```

## Rodar localmente

1. Instale as dependencias:

```bash
npm install
```

2. Rode o projeto:

```bash
npm run dev
```

3. Abra o endereco mostrado no terminal, normalmente:

```
http://localhost:5173
```

## Gerar build

```bash
npm run build
```

A Vercel usa automaticamente:

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`

Essas configuracoes tambem estao em `vercel.json`.

## Banco de dados com Supabase

O projeto ja esta preparado para usar Supabase. Enquanto as variaveis de ambiente nao forem configuradas, o app continua funcionando em modo demonstracao com os dados de `src/data.js`.

### 1. Criar projeto no Supabase

1. Acesse https://supabase.com
2. Crie um novo projeto
3. Abra o menu SQL Editor
4. Copie e rode o arquivo `supabase/schema.sql`

Esse schema cria:

- `profiles`: usuarios e perfil de acesso
- `clients`: clientes
- `client_contacts`: contatos do cliente
- `client_flags`: bloqueios como segura entrega, nao emite nota fiscal e solicita limite
- `processes`: processos vinculados ao cliente
- `orders`: pedidos vinculados ao cliente
- `client_history`: historico do cliente

### 2. Configurar variaveis locais

Crie um arquivo `.env` na raiz do projeto com:

```bash
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
```

Esses valores ficam em Project Settings > API no Supabase.

### 3. Configurar variaveis na Vercel

Na Vercel:

1. Abra o projeto
2. Entre em Settings > Environment Variables
3. Adicione:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Faca um novo deploy

## Conectar ao GitHub

Depois de alterar o projeto localmente:

```bash
git add .
git commit -m "Atualiza Mesa da Equipe"
git push
```

A Vercel deve fazer um novo deploy automaticamente apos o push.

## Proximos passos sugeridos

- Ativar Supabase Auth para login real
- Associar cada colaborador a um registro em `profiles`
- Criar telas de cadastro e edicao de clientes
- Registrar historico automatico por alteracao
- Integrar pedidos, notas e limite com planilhas ou ERP
