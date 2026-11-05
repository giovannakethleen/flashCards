# FlashCards

Aplicação Angular para estudar inglês com frases e palavras em contexto. A estrutura atual já inclui autenticação com Supabase, cadastro rápido de cartões, revisão por intervalo simples, busca e filtros, exportação/importação JSON e suporte PWA.

## Requisitos locais

- Node.js 20 LTS recomendado
- npm
- Conta no Supabase com projeto criado
- Netlify para deploy
- Docker e Kubernetes locais para prática de containerização e orquestração

## Configuração inicial

1. Copie o exemplo de variáveis locais:

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Linux/macOS:

```bash
cp .env.example .env
```

2. Preencha `.env` com os valores do seu projeto Supabase:

```dotenv
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUA_CHAVE_PUBLICA
PRONUNCIATION_ASSESSMENT_ENABLED=false
TRANSLATION_ENABLED=false
```

O arquivo `.env` é ignorado pelo Git. O script de build gera `public/supabase-config.json`, que também é ignorado e incluído no app compilado. Não edite nem envie esse arquivo ao GitHub.

3. Instale dependências e inicie o app:

```bash
npm install
npm start
```

## Build produção

```bash
npm run build
```

O build também lê as variáveis `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` definidas no ambiente, que têm prioridade sobre `.env`.

## Netlify

Em **Site configuration → Environment variables**, adicione:

- `SUPABASE_URL`: URL do projeto, por exemplo `https://SEU-PROJETO.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY`: chave pública que começa com `sb_publishable_`
- `PRONUNCIATION_ASSESSMENT_ENABLED`: `false` por padrão; só use `true` depois de configurar a Edge Function e os segredos Azure
- `TRANSLATION_ENABLED`: `false` por padrão; só use `true` depois de configurar a Edge Function e os segredos Google Cloud

Mantenha o comando de build como `npm run build`. Após salvar as variáveis, faça um novo deploy para que sejam incluídas no build.

Como o Angular roda no navegador, a URL e a **Publishable key** ficam acessíveis no app publicado; essa chave é pública por definição. Proteja os dados com RLS no Supabase. Nunca use `sb_secret_`, `service_role` ou a _Direct connection string_ nessas variáveis.

## Supabase

O projeto usa somente a Publishable key no front-end e nunca envia uma chave secreta para o navegador.

A tabela necessária pode ser criada com o arquivo:

```sql
-- supabase/flashcards.sql
```

Lembre-se de ativar Row Level Security e usar políticas por usuário com `auth.uid() = user_id`.

O painel também usa um calendário de atividade. Depois de criar a tabela `flashcards`, aplique uma vez o SQL:

```sql
-- supabase/activity-calendar.sql
```

Essa migração registra novas adições automaticamente, preenche a data de criação dos cartões que ainda existem e passa a registrar cada revisão junto com a atualização do cartão. Ela não consegue recuperar revisões antigas por dia, pois esses eventos não eram armazenados. O calendário mostra cartões adicionados, cartões distintos estudados e número de tentativas de revisão por dia.

Para habilitar **Meu plano de estudos**, aplique também `supabase/study-plan.sql`. A tela permite planejar atividades, acompanhar as revisões previstas dos flashcards e registrar conclusão. As atividades são protegidas por RLS e associadas à conta autenticada.

### Sugestões de flashcards com Gemini (opcional)

Ao concluir uma atividade do tipo **Estudar unidade ou lição**, é possível colar um resumo revisado e pedir de 3 a 5 sugestões. Somente o resumo e o nível de inglês escolhido são enviados, e apenas após tocar em **Gerar cards com Gemini**. As sugestões aparecem como rascunhos editáveis: a pessoa pode selecionar, excluir ou corrigir cada uma; somente os rascunhos selecionados são salvos no Supabase. A conclusão da lição e o cadastro manual continuam disponíveis se a geração falhar ou não for usada.

O texto é processado pelo Gemini. Na camada gratuita, o Google informa que o conteúdo pode ser usado para melhorar seus produtos. Não envie dados pessoais ou conteúdo que não queira compartilhar. O modelo fixo é `gemini-3.5-flash-lite`, listado na camada gratuita na documentação consultada em 4 de novembro de 2026. Limites variam por projeto e podem mudar; ao receber um limite excedido, a aplicação pede para tentar novamente depois e não muda para um modelo pago nem ativa faturamento automaticamente.

Para publicar a função autenticada:

1. Publique `supabase/functions/generate-flashcards/index.ts`:

   ```bash
   supabase functions deploy generate-flashcards
   ```

2. Cadastre a chave do Gemini somente como segredo da Edge Function:

   ```bash
   supabase secrets set GEMINI_API_KEY=...
   ```

   Nunca coloque a chave no Angular, `.env`, Netlify ou Git. A função valida a sessão, aceita apenas JSON com resumo de até 5.000 caracteres e nível permitido, e valida as sugestões recebidas antes de devolvê-las. Nenhuma sugestão é persistida pela função.

Referências oficiais consultadas em 4 de novembro de 2026: [preços e camada gratuita](https://ai.google.dev/gemini-api/docs/pricing), [modelo Gemini 3.5 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), [limites de uso](https://ai.google.dev/gemini-api/docs/rate-limits) e [termos de uso e processamento dos dados](https://ai.google.dev/gemini-api/terms).

## Prática de pronúncia (opcional)

A gravação é solicitada somente quando a pessoa toca em **Gravar**, fica temporariamente no navegador e é descartada ao sair da prática ou após o envio. A avaliação automática fica desativada por padrão; sem ela, é possível gravar e reproduzir a própria fala sem enviar áudio.

Para manter a integração opcional:

1. Crie/configure o recurso Azure Speech e confira preço, quota e política de dados para sua região antes de ativar. A documentação informa que a avaliação básica tem o preço de Speech-to-Text Standard/commitment; o tier F0 lista 5 horas/mês de transcrição em tempo real compartilhadas entre Standard e Custom, sujeitas às regras do Azure. Preços e limites dependem da região e do tier; não conte com a quota gratuita sem confirmar no painel/pricing do recurso.
2. Publique a função `supabase/functions/pronunciation-assessment/index.ts`:

   ```bash
   supabase functions deploy pronunciation-assessment
   ```

3. Cadastre a chave e a região do Azure como segredos da função, nunca no Angular, Netlify ou Git:

   ```bash
   supabase secrets set AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=... PRONUNCIATION_ASSESSMENT_ENABLED=true
   ```

4. Mantenha o logging de áudio/transcrição do recurso desativado (é o padrão documentado) e não ative customizações que alterem a retenção sem rever a política. A documentação informa retenção de até 30 dias se o logging for ativado.
5. Só então ative a interface automática definindo `PRONUNCIATION_ASSESSMENT_ENABLED=true` no `.env` local ou nas variáveis de build do Netlify e faça um novo build/deploy. A função também exige essa variável ativa nos segredos do Supabase, então não faz chamadas ao Azure se a chave ou a ativação do lado servidor estiverem ausentes. Para desativar, use `false` no build e no segredo Supabase; remova os segredos Azure da função se quiser impedir chamadas ao serviço.

A função exige sessão autenticada, aceita somente WAV PCM mono de 16 kHz, limitado a 15 segundos e 512 KB, e não persiste áudio ou avaliações. O Azure recebe a gravação e o texto de referência após a confirmação explícita; consulte a política de privacidade e os termos do serviço para sua região antes de usar.

Referências oficiais verificadas antes da integração: [formatos e limites do REST curto](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text-short), [assessment, modos, idiomas e preço base](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment), [matriz de idiomas](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=pronunciation-assessment), [preços e quotas](https://azure.microsoft.com/en-us/pricing/details/speech/) e [logging/retention](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/logging-audio-transcription). A matriz lista en-US e en-GB para pronunciation assessment. Esta implementação não solicita a dimensão paga de prosódia.

## Tradução automática de cartões (opcional)

A tradução automática fica desligada por padrão. Sem configuração, o campo em português continua manualmente editável. Quando habilitada, o botão envia somente a frase em inglês para uma Supabase Edge Function autenticada, que a encaminha ao Google Cloud Translation NMT com `en` como origem e `pt-BR` como destino. A tradução aparece como rascunho editável; salvar o cartão grava o texto final revisado pela pessoa. Uma tradução já preenchida só é substituída após confirmação.

Antes de habilitar, considere que a página de preços consultada em 4 de novembro de 2026 lista os primeiros 500.000 caracteres NMT por mês como crédito de US$ 10 e US$ 20 por milhão de caracteres acima desse volume. Esse crédito não é uma garantia de uso gratuito: pode ser compartilhado com outros serviços do projeto Google Cloud, requer configuração de faturamento e preços/termos podem mudar. Alertas de orçamento do Google Cloud não são limites rígidos.

A aplicação aplica limites próprios: até 1.000 caracteres por frase, 30 pedidos por usuário por dia e 450.000 caracteres reservados globalmente por mês. A UI avisa quando o uso reservado atinge 80% do limite mensal. As contagens de uso são guardadas no PostgreSQL; o texto das frases e as traduções não são guardados no registro de uso. Uma reserva é contabilizada antes da chamada para impedir que pedidos concorrentes ultrapassem o teto; falhas da API também consomem a reserva. Esses controles protegem chamadas feitas por esta aplicação, não outros usos da chave Google.

Para configurar:

1. Aplique `supabase/translation-usage.sql` no SQL Editor do Supabase.
2. No Google Cloud, habilite a Cloud Translation API, configure faturamento e restrinja a API key para a Cloud Translation API. Considere também reduzir a quota de caracteres por dia no projeto Google; o padrão documentado para caracteres/dia é ilimitado. Verifique a página de preços e a quota do seu projeto antes de ativar.
3. Publique a Edge Function:

   ```bash
   supabase functions deploy translate-card
   ```

4. Configure os segredos somente na Edge Function do Supabase:

   ```bash
   supabase secrets set GOOGLE_TRANSLATION_API_KEY=... GOOGLE_TRANSLATION_ENABLED=true
   ```

   Opcionalmente, ajuste `TRANSLATION_MONTHLY_CHARACTER_LIMIT` (máximo 500000) e `TRANSLATION_DAILY_REQUEST_LIMIT` (máximo 100). Nunca coloque a chave Google em `.env`, no Netlify, no Angular ou no repositório.

5. Só depois de conferir faturamento, quotas e segredos, defina `TRANSLATION_ENABLED=true` no `.env` local ou nas variáveis de build do Netlify e faça um novo deploy. A integração só funciona se as ativações do build e da Edge Function estiverem ligadas; mantenha ambas como `false` para continuar apenas com tradução manual.

Referências oficiais consultadas em 4 de novembro de 2026: [preços Cloud Translation](https://cloud.google.com/translate/pricing), [quotas e limites](https://cloud.google.com/translate/quotas) e [idiomas suportados](https://cloud.google.com/translate/docs/languages). Nenhuma chamada paga foi realizada durante a implementação.

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

## Kubernetes local

Exemplo de manifest em `kubernetes/deployment.yaml` para prática com Kind ou Minikube.

## Observações

- O Docker não está disponível neste ambiente de execução, portanto os containers não foram executados aqui.
- O app precisa das variáveis do Supabase configuradas antes do login real funcionar.
- As políticas e a tabela do banco devem ser aplicadas no painel do Supabase antes da autenticação e dos testes de gravação.

# flashCards
