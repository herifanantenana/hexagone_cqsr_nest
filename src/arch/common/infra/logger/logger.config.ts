// Configuration centralisee du logger
// 2 modes : via ConfigService (DI) ou via process.env (fallback hors DI)

import { ConfigService } from '@nestjs/config';

export interface LoggerConfig {
  level: string; // error, warn, info, http, debug, verbose
  dir: string; // Dossier de destination des fichiers de log
  console: boolean; // Activer les logs console
  file: boolean; // Activer la persistence en fichiers
}

// Via ConfigService (utilise dans LoggerModule)
export function loadLoggerConfig(config: ConfigService): LoggerConfig {
  return {
    level: config.get<string>('LOG_LEVEL') || 'debug',
    dir: config.get<string>('LOG_DIR') || 'logs',
    console: config.get<string>('LOG_CONSOLE', 'true') !== 'false',
    file: config.get<string>('LOG_FILE', 'false') !== 'false',
  };
}

// Fallback process.env (utilise par AppLogger.create() avant le boot DI)
export function loadLoggerConfigFromEnv(): LoggerConfig {
  return {
    level: process.env.LOG_LEVEL || 'debug',
    dir: process.env.LOG_DIR || 'logs',
    console: (process.env.LOG_CONSOLE ?? 'true') !== 'false',
    file: (process.env.LOG_FILE ?? 'false') !== 'false',
  };
}
