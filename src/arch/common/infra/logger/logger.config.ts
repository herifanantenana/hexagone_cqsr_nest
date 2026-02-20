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

export function loadLoggerConfig(): LoggerConfig {
  const isProd = process.env.NODE_ENV === 'production';

  return {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || 'logs',
    console:
      process.env.LOG_CONSOLE !== undefined
        ? process.env.LOG_CONSOLE === 'true'
        : true, // Activé par défaut
    file:
      process.env.LOG_FILE !== undefined
        ? process.env.LOG_FILE === 'true'
        : isProd, // Activé uniquement en prod par défaut
    http:
      process.env.LOG_HTTP !== undefined
        ? process.env.LOG_HTTP === 'true'
        : true, // Activé par défaut
    jsonFiles:
      process.env.LOG_JSON_FILES !== undefined
        ? process.env.LOG_JSON_FILES === 'true'
        : isProd, // JSON en prod, texte en dev
    rotate:
      process.env.LOG_ROTATE !== undefined
        ? process.env.LOG_ROTATE === 'true'
        : isProd, // Rotation uniquement en prod par défaut
    maxFiles: process.env.LOG_MAX_FILES || '14d',
  };
}
