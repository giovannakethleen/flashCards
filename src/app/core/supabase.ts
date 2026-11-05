import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;
let pronunciationAssessmentEnabled = false;
let translationEnabled = false;

function getEnvValue(...names: string[]) {
  const env = import.meta.env as Record<string, string | undefined>;

  for (const name of names) {
    const value = env[name];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

export function resolveSupabaseConfig() {
  return {
    url: getEnvValue('VITE_SUPABASE_URL', 'SUPABASE_URL'),
    publishableKey: getEnvValue(
      'VITE_SUPABASE_PUBLISHABLE_KEY',
      'VITE_SUPABASE_ANON_KEY',
      'SUPABASE_PUBLISHABLE_KEY',
      'SUPABASE_ANON_KEY',
    ),
  };
}

export function configureSupabase(
  supabaseUrl: string,
  publishableKey: string,
  enablePronunciationAssessment = false,
  enableTranslation = false,
): void {
  pronunciationAssessmentEnabled = enablePronunciationAssessment;
  translationEnabled = enableTranslation;

  if (!supabaseUrl || !publishableKey) {
    supabaseClient = null;
    return;
  }

  supabaseClient = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export function configureSupabaseFromEnvironment(): void {
  const { url, publishableKey } = resolveSupabaseConfig();
  configureSupabase(url, publishableKey);
}

export function getSupabaseClient(): SupabaseClient | null {
  return supabaseClient;
}

export function isPronunciationAssessmentEnabled(): boolean {
  return pronunciationAssessmentEnabled;
}

export function isTranslationEnabled(): boolean {
  return translationEnabled;
}
