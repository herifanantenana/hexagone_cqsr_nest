// Configuration centralisée du logger, pilotée par variables d'environnement
// Valeurs par défaut adaptées au développement (console active, fichiers désactivés)

export interface LoggerConfig {
  level: string; // Niveau minimum : error, warn, info, http, debug
  dir: string; // Dossier de destination des fichiers de log
  console: boolean; // Activer les logs console (lisible, coloré)
  file: boolean; // Activer la persistence en fichiers
  http: boolean; // Activer les logs HTTP (requêtes entrantes/sortantes)
  jsonFiles: boolean; // Format JSON dans les fichiers (true en prod, false = texte)
  rotate: boolean; // Rotation quotidienne des fichiers
  maxFiles: string; // Durée de rétention (ex: "14d") ou nombre max de fichiers
}

// Parse un booléen depuis une variable d'environnement
// Gère : "true", " true ", "TRUE", "1", "yes" → true. Tout le reste → false.
// split('#')[0] supprime les commentaires inline (ex: "true   # commentaire" → "true")
// .trim() supprime les espaces résiduels autour de la valeur
function envBool(key: string, defaultValue: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined) return defaultValue;
  const trimmed = raw.split('#')[0].trim().toLowerCase();
  return trimmed === 'true' || trimmed === '1' || trimmed === 'yes';
}

// Parse une chaîne depuis une variable d'environnement
// Supprime les commentaires inline et les espaces résiduels
function envString(key: string, defaultValue: string): string {
  const raw = process.env[key];
  if (raw === undefined) return defaultValue;
  return raw.split('#')[0].trim() || defaultValue;
}

export function loadLoggerConfig(): LoggerConfig {
  const isProd = process.env.NODE_ENV === 'production';

  return {
    // LOG_LEVEL=http par défaut : inclut error, warn, info ET http
    // Mettre "info" pour désactiver les logs HTTP, "debug" pour tout voir
    level: envString('LOG_LEVEL', 'http'),
    dir: envString('LOG_DIR', 'logs'),
    console: envBool('LOG_CONSOLE', true),
    file: envBool('LOG_FILE', isProd),
    http: envBool('LOG_HTTP', true),
    jsonFiles: envBool('LOG_JSON_FILES', isProd),
    rotate: envBool('LOG_ROTATE', isProd),
    maxFiles: envString('LOG_MAX_FILES', '14d'),
  };
}
