import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const envFilePath = resolve(projectRoot, '.env');
const configFilePath = resolve(projectRoot, 'public', 'supabase-config.json');

function readLocalEnv() {
  let contents;

  try {
    contents = readFileSync(envFilePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {};
    }

    throw error;
  }

  return Object.fromEntries(
    contents
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/))
      .filter(Boolean)
      .map(([, name, rawValue]) => {
        const value =
          rawValue.startsWith('"') && rawValue.endsWith('"')
            ? rawValue.slice(1, -1)
            : rawValue.startsWith("'") && rawValue.endsWith("'")
              ? rawValue.slice(1, -1)
              : rawValue;

        return [name, value];
      }),
  );
}

const localEnv = readLocalEnv();
const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  localEnv.SUPABASE_URL ||
  localEnv.VITE_SUPABASE_URL ||
  '';
const publishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  localEnv.SUPABASE_PUBLISHABLE_KEY ||
  localEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
  localEnv.SUPABASE_ANON_KEY ||
  localEnv.VITE_SUPABASE_ANON_KEY ||
  '';
const pronunciationAssessmentEnabled =
  (process.env.PRONUNCIATION_ASSESSMENT_ENABLED ?? localEnv.PRONUNCIATION_ASSESSMENT_ENABLED) ===
  'true';
const translationEnabled =
  (process.env.TRANSLATION_ENABLED ?? localEnv.TRANSLATION_ENABLED) === 'true';

if (Boolean(supabaseUrl) !== Boolean(publishableKey)) {
  throw new Error('Defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY juntos.');
}

if (supabaseUrl) {
  let parsedUrl;

  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    throw new Error('SUPABASE_URL precisa ser uma URL válida.');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('SUPABASE_URL precisa usar HTTP ou HTTPS.');
  }
} else {
  console.warn('Supabase não configurado. Defina as variáveis no .env ou no ambiente de build.');
}

writeFileSync(
  configFilePath,
  `${JSON.stringify(
    { supabaseUrl, publishableKey, pronunciationAssessmentEnabled, translationEnabled },
    null,
    2,
  )}\n`,
  'utf8',
);
