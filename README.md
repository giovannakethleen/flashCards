# FlashCards

Aplicação Angular para estudar inglês com frases e palavras em contexto. A estrutura atual já inclui autenticação com Supabase, cadastro rápido de cartões, revisão por intervalo simples, busca e filtros, exportação/importação JSON e suporte PWA.

## Requisitos locais

- Node.js 20 LTS recomendado
- npm
- Conta no Supabase com projeto criado
- Netlify para deploy
- Docker e Kubernetes locais para prática de containerização e orquestração

## Configuração inicial

1. Copie o exemplo de configuração:

Windows PowerShell:
```powershell
Copy-Item .env.example .env
Copy-Item src/environments/environment.example.ts src/environments/environment.ts
```

Linux/macOS:
```bash
cp .env.example .env
cp src/environments/environment.example.ts src/environments/environment.ts
```

2. Preencha os valores reais do seu projeto Supabase:

```ts
export const environment = {
  production: true,
  supabaseUrl: 'https://SEU-PROJETO.supabase.co',
  supabaseAnonKey: 'SUA_CHAVE_PUBLICA_ANON',
};
```

3. Instale dependências:

```bash
npm install
```

4. Inicie o app:

Windows PowerShell:
```powershell
npx ng serve --host 0.0.0.0 --port 4200
```

Linux/macOS:
```bash
npx ng serve --host 0.0.0.0 --port 4200
```

## Build produção

```bash
npm run build
```

## Supabase

O projeto usa a chave pública do Supabase no front-end e nunca manda `service_role` para o navegador.

A tabela necessária pode ser criada com o arquivo:

```sql
-- supabase/flashcards.sql
```

Lembre-se de ativar Row Level Security e usar políticas por usuário com `auth.uid() = user_id`.

## Docker

Arquivo de exemplo disponibilizado em `Dockerfile` e `docker-compose.yml`.

Windows PowerShell:
```powershell
docker compose up --build
```

Linux/macOS:
```bash
docker compose up --build
```

## Netlify

Configuração pronta em `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist/flashcards"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

No painel do Netlify, configure:
- build command: `npm run build`
- publish directory: `dist/flashcards`
- variáveis de ambiente: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (quando aplicável)

## Kubernetes local

Exemplo de manifest em `kubernetes/deployment.yaml` para prática com Kind ou Minikube.

## Observações

- O Docker não está disponível neste ambiente de execução, portanto os containers não foram executados aqui.
- O app precisa das variáveis do Supabase configuradas antes do login real funcionar.
- As políticas e a tabela do banco devem ser aplicadas no painel do Supabase antes da autenticação e dos testes de gravação.
# flashCards
