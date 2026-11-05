# Documentação do projeto FlashCards

Este documento reúne a estrutura e o estado atual do FlashCards: tecnologias, funcionalidades, integrações, configuração e formas de execução. É uma referência técnica do projeto, não um histórico cronológico de cada alteração feita.

Para instruções de configuração detalhadas, especialmente para Supabase, Netlify, tradução e pronúncia, consulte também o [README.md](./README.md).

## Visão geral

FlashCards é uma aplicação web para apoiar o estudo de inglês por meio de cartões com frases em contexto. O projeto inclui autenticação, revisão espaçada simples, acompanhamento de atividade, plano de estudos, recursos de áudio e suporte a instalação como PWA.

Os dados dos cartões e das atividades ficam no Supabase. Tradução automática e avaliação automática de pronúncia são integrações opcionais, desligadas por padrão e executadas por Supabase Edge Functions.

## Tecnologias e linguagens

| Tecnologia ou linguagem | Uso no projeto |
|---|---|
| TypeScript | Aplicação Angular, componentes, serviços e Edge Functions |
| HTML | Templates da interface e documento inicial |
| SCSS | Estilos globais e estilos das telas |
| SQL / PostgreSQL | Estrutura do banco, políticas RLS, funções e registro de atividade no Supabase |
| JavaScript (ES modules) | Script Node.js que gera a configuração do Supabase para o build |
| Deno | Runtime das Supabase Edge Functions; dependências e aliases estão em `supabase/functions/deno.json` |
| JSON | Configurações do Angular, TypeScript, PWA, variáveis de exemplo e dados de cartões |
| YAML | Compose e manifesto de deployment/service do Kubernetes |
| Dockerfile | Build multi-stage da aplicação e imagem de execução com Nginx |
| Nginx | Servidor dos arquivos estáticos e fallback das rotas Angular |
| Markdown | Documentação do projeto |

### Principais dependências

- Angular 21, com componentes standalone e roteamento do Angular.
- TypeScript 5.9 e RxJS 7.
- Supabase JS 2 para autenticação, banco de dados e chamadas às Edge Functions.
- Angular Service Worker para recursos de PWA.
- Node.js 20 LTS recomendado para desenvolvimento e build.
- npm 11 indicado pelo campo `packageManager` do projeto.

## Estrutura de pastas

```text
.
├── public/                 Arquivos públicos servidos junto com a aplicação
│   ├── icons/              Ícones do PWA
│   ├── images/             Imagens
│   ├── manifest.webmanifest
│   └── supabase-config.json Configuração gerada durante start/build; não versionar
├── scripts/
│   └── generate-supabase-config.mjs
├── src/
│   ├── main.ts             Inicialização, leitura da configuração e bootstrap Angular
│   ├── index.html
│   ├── styles.scss         Estilos globais
│   └── app/
│       ├── app.ts / app.html / app.scss
│       ├── app.config.ts   Providers da aplicação e registro do Service Worker
│       ├── app.routes.ts   Rotas e proteção das áreas autenticadas
│       ├── auth/           Tela de autenticação
│       ├── cards/          Lista, cadastro, serviço e prática dos cartões
│       ├── core/           Autenticação, guard, Supabase, áudio e integrações
│       ├── dashboard/      Painel e indicadores de atividade
│       ├── review/         Fluxo de revisão de cartões
│       └── study-plan/     Plano de estudos e respectivo serviço
├── supabase/
│   ├── *.sql               Tabelas, políticas, funções e migrações SQL
│   └── functions/          Edge Functions
├── kubernetes/
│   └── deployment.yaml     Deployment e Service de exemplo
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
├── netlify.toml
└── angular.json
```

### Responsabilidades principais do código Angular

- `src/main.ts`: carrega `supabase-config.json`, valida o formato e inicializa a aplicação.
- `src/app/app.routes.ts`: define as telas de login, painel, cartões, cadastro, revisão e plano de estudos. As rotas internas usam `AuthGuard` e `WorkspaceShellComponent`.
- `src/app/core/auth.service.ts`: encapsula autenticação Supabase e expõe o estado da sessão.
- `src/app/core/supabase.ts`: cria e disponibiliza o cliente Supabase e os sinalizadores das integrações opcionais.
- `src/app/cards/card.service.ts`: operações de cartões, revisões e estatísticas.
- `src/app/core/speech.service.ts`: reprodução de fala usando a Web Speech API do navegador.
- `src/app/core/pronunciation.service.ts`: envio autenticado da gravação para avaliação e validação da resposta.
- `src/app/core/translation.service.ts`: chamada autenticada da tradução e validação do uso retornado.
- `src/app/study-plan/study-plan.service.ts`: consulta e atualização das atividades do plano.

## Funcionalidades implementadas

- **Autenticação:** cadastro, entrada, saída e recuperação de senha via Supabase Auth.
- **Cartões:** cadastro de frases em inglês e sua tradução, com campos de apoio como palavra em foco, categoria, origem e informação de áudio.
- **Revisão:** cartões vencidos são apresentados para estudo; o resultado atualiza os contadores e a próxima data de revisão.
- **Painel:** indicadores e calendário de atividade, com cartões adicionados, cartões distintos estudados e número de revisões por dia.
- **Plano de estudos:** registro de atividades planejadas ou concluídas e visualização de revisões previstas.
- **Pronúncia:** reprodução de texto e gravação local para prática; quando habilitada, a avaliação automática usa uma Edge Function e Azure Speech.
- **Tradução:** quando habilitada, uma frase em inglês pode ser enviada para tradução automática de rascunho para português brasileiro. O texto permanece editável antes de ser salvo.
- **PWA:** manifesto, ícones e cache de recursos estáticos por meio do Angular Service Worker.
- **Importação/exportação de dados:** o README descreve suporte a JSON; `exemplos-cartoes.json` contém exemplos de cartões.

## Dados e integração com Supabase

O front-end usa a Publishable key, que é pública por definição, e não deve receber uma chave `service_role` ou `sb_secret_`. A proteção dos dados é feita no banco, com Row Level Security (RLS), vinculando registros ao usuário autenticado.

| Arquivo | Finalidade |
|---|---|
| `supabase/flashcards.sql` | Tabela `flashcards`, índices e política para cada usuário gerenciar os próprios cartões |
| `supabase/activity-calendar.sql` | Tabela de atividade, registro de criação/revisão e funções para o calendário |
| `supabase/study-plan.sql` | Tabela e políticas das atividades do plano de estudos |
| `supabase/translation-usage.sql` | Contadores de uso e função de reserva para limitar chamadas de tradução |
| `supabase/functions/translate-card/index.ts` | Edge Function autenticada que controla limites e encaminha a solicitação de tradução |
| `supabase/functions/pronunciation-assessment/index.ts` | Edge Function autenticada que valida o áudio e encaminha a avaliação de pronúncia |

O SQL deve ser aplicado ao projeto Supabase antes de usar os recursos correspondentes. A configuração detalhada e os limites das integrações estão no [README.md](./README.md).

### Revisão dos cartões

A função `record_flashcard_review` valida o resultado e registra a revisão. Os intervalos atualmente definidos no SQL são:

| Resultado | Próxima revisão |
|---|---:|
| `miss` | 1 hora |
| `hard` | 1 dia |
| `remembered` | 3 dias |
| `easy` | 7 dias |

O registro de atividade permite contar revisões e cartões únicos estudados em cada dia. A migração do calendário preenche a atividade de criação para cartões já existentes, mas não consegue recuperar revisões antigas que não haviam sido registradas.

### Integrações opcionais e privacidade

- `PRONUNCIATION_ASSESSMENT_ENABLED` controla a avaliação automática. A gravação é solicitada por ação explícita e pode ser reproduzida localmente sem avaliação. Quando enviada, a Edge Function aceita áudio WAV PCM mono de 16 kHz, limitado a 15 segundos e 512 KB; os segredos Azure ficam apenas nos segredos da função.
- `TRANSLATION_ENABLED` controla a tradução automática. O texto é encaminhado pelo Supabase à API Google Cloud Translation. Os limites de uso são aplicados pela função e registrados no banco; a chave Google fica apenas nos segredos da função.
- As duas integrações estão desativadas por padrão. É necessário habilitar a configuração no build e no servidor conforme o [README.md](./README.md); nunca coloque chaves privadas no navegador, `.env` versionado ou variáveis públicas de hospedagem.

## Configuração e execução local

1. Instale Node.js 20 LTS e npm.
2. Crie o `.env` local a partir do exemplo:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Configure `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`. As opções `PRONUNCIATION_ASSESSMENT_ENABLED` e `TRANSLATION_ENABLED` devem permanecer `false` até que as integrações estejam configuradas.
4. Instale as dependências e inicie o servidor:

   ```powershell
   npm install
   npm start
   ```

O script `scripts/generate-supabase-config.mjs` lê variáveis do ambiente e do `.env`, valida a URL e gera `public/supabase-config.json`. As variáveis de ambiente do processo têm precedência sobre as do `.env`. O arquivo gerado é ignorado pelo Git e deve ser tratado como artefato de build, ainda que a Publishable key nele contida seja pública.

Comandos disponíveis:

| Comando | Ação |
|---|---|
| `npm start` | Gera a configuração e inicia `ng serve` |
| `npm run build` | Gera a configuração e cria o build de produção |
| `npm run watch` | Gera a configuração e compila em modo watch de desenvolvimento |
| `npm test` | Executa `ng test` |

## Build e publicação

- **Angular:** `angular.json` define `src/main.ts` como entrada, SCSS como linguagem de estilo e limites de tamanho para o build de produção. O Service Worker é ativado fora do modo de desenvolvimento.
- **Netlify:** `netlify.toml` define `npm run build`, publica `dist/flashcards/browser` e reescreve rotas para `index.html`. As variáveis necessárias devem ser definidas na configuração do site antes do deploy.
- **Docker:** o `Dockerfile` executa `npm ci` e o build em Node 20 Alpine; a imagem final usa Nginx Alpine para servir `dist/flashcards/browser`. O `docker-compose.yml` publica a aplicação na porta local `4200`.
- **Nginx:** `nginx.conf` usa `index.html` como fallback para rotas do Angular.
- **Kubernetes:** `kubernetes/deployment.yaml` contém exemplos de Deployment (uma réplica) e Service. A imagem está indicada como `flashcards-app:local`; deve existir no cluster local ou ser substituída pela imagem publicada.

## Qualidade e testes

O TypeScript está configurado em modo estrito, incluindo verificações estritas de templates Angular. O projeto define `npm test` para `ng test`; na estrutura inspecionada para esta documentação não foram encontrados arquivos de teste `*.spec.ts` ou `*.test.ts`.

## Arquivos úteis

- [README.md](./README.md): instruções operacionais, passos de configuração e detalhes completos de implantação e integrações.
- [exemplos-cartoes.json](./exemplos-cartoes.json): exemplo de conteúdo para cartões.
- [package.json](./package.json): scripts e dependências.
- [angular.json](./angular.json): configuração do build Angular.
- [.env.example](./.env.example): nomes e valores ilustrativos das variáveis de ambiente; não contém credenciais reais.
- [ngsw-config.json](./ngsw-config.json): recursos armazenados pelo Service Worker.
