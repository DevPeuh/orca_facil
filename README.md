# OrçaFácil

Aplicação web para prestadores de serviço autônomos criarem e acompanharem orçamentos. Reúne cadastro de clientes, catálogo de serviços, propostas e dados do negócio em uma interface adaptada para computador e celular.

A versão atual funciona com armazenamento no navegador, sem cadastro de conta ou banco de dados remoto.

![Painel do OrçaFácil com o total orçado no mês, indicadores de status e os últimos orçamentos](docs/images/visao-geral.png)

## Funcionalidades

- **Visão geral:** total orçado no mês, propostas aceitas, recusadas e aguardando resposta.
- **Clientes:** cadastro, busca, edição e exclusão de contatos.
- **Serviços e produtos:** catálogo com descrição, unidade e preço para reutilizar nos orçamentos.
- **Orçamentos:** itens do catálogo ou manuais, descontos, acréscimos, validade e condições de pagamento.
- **Acompanhamento:** numeração sequencial, duplicação e controle de rascunhos, enviados, aceitos, recusados e expirados.
- **Documento:** impressão, opção de salvar como PDF e resumo para compartilhar pelo WhatsApp.
- **Meu negócio:** dados do prestador e exportação ou restauração de backup JSON.

## Telas

### Dados do negócio e backup

Os dados do prestador são usados no documento entregue ao cliente. Nesta tela também ficam as opções de exportar e restaurar os cadastros.

![Tela Meu negócio com dados do prestador e botões de exportação e restauração de backup](docs/images/meu-negocio.png)

### Versão no celular

O layout reorganiza a navegação e os indicadores para telas menores.

<img src="docs/images/visao-geral-mobile.png" alt="Visão geral do OrçaFácil em uma tela de celular" width="320">

## Tecnologias

| Tecnologia | Uso |
| --- | --- |
| React e TypeScript | Interface e regras da aplicação |
| React Hook Form e Zod | Formulários e validação dos dados |
| Lucide | Ícones |
| CSS e Tailwind CSS | Estilos, responsividade e impressão |
| Vinext e Vite | Desenvolvimento e build |
| Cloudflare Workers | Runtime da aplicação compilada |

## Instalação

Requer **Node.js 22.13 ou superior** e **npm**. Na pasta do projeto, execute:

```bash
npm ci
npm run dev
```

Abra o endereço informado pelo terminal. A aplicação começa com os cadastros vazios.

## Verificações e build

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Para conferir a versão compilada, execute `npm start` depois de `npm run build`. A prévia usa `vite preview` e escuta apenas em `127.0.0.1`. Esse comando não publica o aplicativo na internet.

## Estrutura

O projeto usa as convenções de rotas do Next.js por meio do Vinext.

- `app/page.tsx`: navegação, painel e lista de orçamentos.
- `app/globals.css`: estilos, responsividade e impressão.
- `components/catalogs.tsx`: clientes, serviços e dados do prestador.
- `components/quote-editor.tsx`: formulário de orçamento.
- `components/quote-document.tsx`: documento e compartilhamento.
- `lib/domain.ts`: cálculos, datas, numeração e status.
- `lib/storage.ts`: persistência e validação de backups.
- `lib/*.test.ts`: testes de cálculo e armazenamento.
- `worker/index.ts`: entrada do Cloudflare Worker.
- `docs/images/`: capturas de tela usadas neste README.

## Uso

1. Preencha os dados do prestador em **Meu negócio**.
2. Cadastre um cliente e, se quiser, um catálogo de serviços.
3. Crie um orçamento com itens, validade e condições de pagamento.
4. Salve o rascunho e abra **Ver** para revisar o documento.
5. Imprima ou salve como PDF. O botão do WhatsApp abre um resumo para revisão e envio manual.
6. Marque o orçamento como enviado e registre a resposta do cliente.
7. Exporte um backup regularmente em **Meu negócio**.
