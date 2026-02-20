// Factory Winston : crée l'instance unique du logger avec tous les transports configurés
// Console = format lisible et coloré | Fichiers = JSON structuré (facile à parser)
// Séparation par niveau : error.log, warn.log, combined.log, http.log

import { existsSync, mkdirSync } from 'fs';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { loadLoggerConfig, LoggerConfig } from './logger.config';

// Niveaux personnalisés : on ajoute "http" entre warn et info
// Plus le nombre est élevé, plus le niveau est verbeux
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'cyan',
    debug: 'magenta',
  },
};

winston.addColors(customLevels.colors);

// Format console : "2025-01-15 10:30:45 [INFO] [Auth] User logged in {requestId: abc-123}"
function buildConsoleFormat(): winston.Logform.Format {
  return winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
      ({ timestamp, level, message, context, requestId, ...meta }) => {
        const ctx = context ? ` [${context as string}]` : '';
        const rid = requestId ? ` {requestId: ${requestId as string}}` : '';
        const extra =
          Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp as string} ${level}${ctx} ${message as string}${rid}${extra}`;
      },
    ),
  );
}

// Format fichier JSON : structuré avec tous les champs (prod)
function buildFileFormat(): winston.Logform.Format {
  return winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  );
}

// Format fichier texte : lisible, sans couleurs (dev)
// Exemple : "2026-02-20 10:30:45 [INFO] [Bootstrap] App running {port: 3000}"
function buildFilePlainFormat(): winston.Logform.Format {
  return winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(
      ({ timestamp, level, message, context, requestId, ...meta }) => {
        const ctx = context ? ` [${(context as string).toUpperCase()}]` : '';
        const rid = requestId ? ` {requestId: ${requestId as string}}` : '';
        // Exclure les champs déjà affichés pour éviter les doublons
        const rest = meta as Record<string, unknown> & {
          splat?: unknown;
        };
        const extra =
          Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
        return `${timestamp as string} [${level.toUpperCase()}]${ctx} ${message as string}${rid}${extra}`;
      },
    ),
  );
}

// Crée un transport fichier avec rotation quotidienne
function createRotateTransport(
  config: LoggerConfig,
  filename: string,
  level?: string,
): DailyRotateFile {
  return new DailyRotateFile({
    dirname: config.dir,
    filename: `${filename}-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    maxFiles: config.maxFiles,
    level,
    format: config.jsonFiles ? buildFileFormat() : buildFilePlainFormat(),
  });
}

// Crée un transport fichier simple (sans rotation)
function createFileTransport(
  config: LoggerConfig,
  filename: string,
  level?: string,
): winston.transports.FileTransportInstance {
  return new winston.transports.File({
    dirname: config.dir,
    filename: `${filename}.log`,
    level,
    format: config.jsonFiles ? buildFileFormat() : buildFilePlainFormat(),
  });
}

export function createWinstonLogger(): winston.Logger {
  const config = loadLoggerConfig();

  // Créer le dossier de logs si nécessaire
  if (config.file && !existsSync(config.dir)) {
    mkdirSync(config.dir, { recursive: true });
  }

  const transports: winston.transport[] = [];

  // Transport console (format lisible et coloré)
  if (config.console) {
    transports.push(
      new winston.transports.Console({
        format: buildConsoleFormat(),
      }),
    );
  }

  // Transports fichier, séparés par niveau
  if (config.file) {
    const createTransport = config.rotate
      ? createRotateTransport
      : createFileTransport;

    // error.log : uniquement les erreurs (avec stack traces)
    transports.push(createTransport(config, 'error', 'error'));

    // warn.log : uniquement les warnings
    transports.push(createTransport(config, 'warn', 'warn'));

    // combined.log : info et au-dessus (error + warn + info)
    transports.push(createTransport(config, 'combined', 'info'));

    // http.log : uniquement les logs HTTP (requêtes entrantes/sortantes)
    if (config.http) {
      transports.push(createTransport(config, 'http', 'http'));
    }
  }

  // Filet de sécurité : si aucun transport n'a été configuré (mauvaise config env),
  // on ajoute toujours une console pour éviter le warning
  // "[winston] Attempt to write logs with no transports"
  if (transports.length === 0) {
    transports.push(
      new winston.transports.Console({
        format: buildConsoleFormat(),
      }),
    );
  }

  return winston.createLogger({
    levels: customLevels.levels,
    level: config.level,
    // Pas de format racine : chaque transport gère son propre format
    // (un format racine json() interférait avec le pipeline de streams Winston
    // et pouvait déclencher le warning "no transports" même quand ils étaient présents)
    transports,
    // Ne pas crasher l'app si Winston a un problème interne
    exitOnError: false,
  });
}
