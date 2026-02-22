// Factory Winston : cree l'instance unique du logger
// Console : utilities.format.nestLike (colore)
// Fichiers : formatFileLine sans couleurs ANSI (fichiers texte brut)

import { existsSync, mkdirSync } from 'fs';
import { utilities } from 'nest-winston';
import * as winston from 'winston';
import { LoggerConfig } from './logger.config';

const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
    verbose: 5,
  },
};

const pid = process.pid;

const ANSI: Record<string, string> = {
  error: '\x1b[1;31m',
  warn: '\x1b[33m',
  info: '\x1b[32m',
  http: '\x1b[36m',
  debug: '\x1b[35m',
  verbose: '\x1b[90m',
  reset: '\x1b[0m',
  dim: '\x1b[2m',
};

function formatFileLine(
  info: winston.Logform.TransformableInfo,
  colors: boolean,
): string {
  const { timestamp, level, message, context, ms, stack, ...meta } = info;

  const c = colors ? ANSI[level] || '' : '';
  const r = colors ? ANSI.reset : '';
  const d = colors ? ANSI.dim : '';

  const ctx = context ? `${c}[${context as string}]${r} ` : '';
  const msStr = ms ? ` ${d}${ms as string}${r}` : '';
  const extra = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';

  let line = `${pid} - ${timestamp as string}   ${c}${level.toUpperCase().padEnd(7)}${r} ${ctx}${message as string}${msStr}${extra}`;

  if (stack) {
    line += `\n${c}${stack as string}${r}`;
  }

  return line;
}

export function createWinstonLogger(config: LoggerConfig): winston.Logger {
  if (config.file && !existsSync(config.dir)) {
    mkdirSync(config.dir, { recursive: true });
  }

  const transports: winston.transport[] = [];

  // Console : nestLike colore
  if (config.console) {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.errors({ stack: true }),
          winston.format.timestamp(),
          winston.format.ms(),
          utilities.format.nestLike('App', {
            colors: true,
            prettyPrint: true,
            processId: true,
            appName: false,
          }),
        ),
      }),
    );
  }

  // Fichiers : formatFileLine sans couleurs (texte brut lisible)
  if (config.file) {
    const fileFormat = winston.format.combine(
      winston.format.errors({ stack: true }),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.ms(),
      winston.format.printf((info) => formatFileLine(info, false)),
    );

    transports.push(
      new winston.transports.File({
        dirname: config.dir,
        filename: 'error.log',
        level: 'error',
        format: fileFormat,
      }),
    );

    transports.push(
      new winston.transports.File({
        dirname: config.dir,
        filename: 'combined.log',
        format: fileFormat,
      }),
    );
  }

  if (transports.length === 0) {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.errors({ stack: true }),
          winston.format.timestamp(),
          winston.format.ms(),
          utilities.format.nestLike('App', {
            colors: true,
            prettyPrint: true,
            processId: true,
            appName: false,
          }),
        ),
      }),
    );
  }

  return winston.createLogger({
    levels: customLevels.levels,
    level: config.level,
    transports,
    exitOnError: false,
  });
}
