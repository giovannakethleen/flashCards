import { bootstrapApplication } from '@angular/platform-browser';

import { App } from './app/app';
import { appConfig } from './app/app.config';
import { configureSupabase } from './app/core/supabase';

async function startApp() {
  const response = await fetch(new URL('supabase-config.json', document.baseURI));

  if (!response.ok) {
    throw new Error(`Falha ao carregar a configuração do Supabase: HTTP ${response.status}.`);
  }

  const config: unknown = await response.json();

  if (
    typeof config !== 'object' ||
    config === null ||
    !('supabaseUrl' in config) ||
    typeof config.supabaseUrl !== 'string' ||
    !('publishableKey' in config) ||
    typeof config.publishableKey !== 'string' ||
    !('pronunciationAssessmentEnabled' in config) ||
    typeof config.pronunciationAssessmentEnabled !== 'boolean' ||
    !('translationEnabled' in config) ||
    typeof config.translationEnabled !== 'boolean'
  ) {
    throw new Error('O arquivo de configuração do Supabase tem um formato inválido.');
  }

  configureSupabase(
    config.supabaseUrl,
    config.publishableKey,
    config.pronunciationAssessmentEnabled,
    config.translationEnabled,
  );
  await bootstrapApplication(App, appConfig);
}

void startApp().catch((error) => {
  console.error('Falha ao iniciar a aplicação.', error);
});
