# Mesa da Equipe

Protótipo de software de gestão operacional orientado a **clientes**, pronto para deploy na Vercel.

A proposta mudou de "gerenciar tarefas soltas" para "gerenciar a situação do cliente". Isso deixa mais natural acompanhar bloqueios como:

- Segura entrega
- Não emite nota fiscal
- Solicita limite
- Pendências comerciais, fiscais, financeiras e logísticas

## Estrutura

```
.
├── index.html
├── package.json
├── vercel.json
├── src/
│   ├── main.jsx
│   ├── data.js
│   └── styles.css
└── README.md
```

## Rodar localmente

1. Instale as dependências:

```bash
npm install
```

2. Rode o projeto:

```bash
npm run dev
```

3. Abra o endereço mostrado no terminal, normalmente:

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

Essas configurações também estão em `vercel.json`.

## Conectar ao GitHub

Depois que o Git estiver inicializado e o primeiro commit existir:

```bash
git remote add origin https://github.com/SEU-USUARIO/mesa-da-equipe.git
git branch -M main
git push -u origin main
```

Depois:

1. Entre em https://vercel.com
2. Clique em **Add New Project**
3. Importe o repositório do GitHub
4. Confirme as configurações detectadas
5. Clique em **Deploy**

## Tornar privado ou público

Na Vercel, você pode começar com o projeto privado. Depois, quando quiser compartilhar com a equipe, basta ajustar as permissões/domínio no painel da Vercel.

## Próximos passos sugeridos

- Adicionar cadastro real de clientes
- Adicionar banco de dados
- Criar login por perfil: gestora e colaborador
- Registrar histórico automático por alteração
- Integrar pedidos/notas/limite com planilhas ou ERP
