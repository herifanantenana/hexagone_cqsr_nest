// Module global qui fournit Winston + AppLogger à toute l'application
// @Global : pas besoin d'importer LoggerModule dans chaque module

import { Global, Module } from '@nestjs/common';
import { config as dotenvLoad } from 'dotenv';
import { existsSync } from 'fs';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { resolve } from 'path';
import { AppLogger } from './logger.service';
import { createWinstonLogger } from './winston.instance';

// ─── Timing fix ──────────────────────────────────────────────────────────────
// Ce module est importé (et évalué) AVANT que NestJS/ConfigModule ait eu le
// temps de charger le fichier .env via dotenv. Sans ce bloc, createWinstonLogger()
// lit process.env avec uniquement les variables système (pas celles du .env).
// → On charge les fichiers .env ici, en ordre décroissant de priorité,
//   avec override: false pour ne jamais écraser les variables déjà définies
//   (système ou chargées par un fichier de priorité supérieure).
for (const file of ['.env', '.env.dev', '.env.example']) {
  const p = resolve(process.cwd(), file);
  if (existsSync(p)) dotenvLoad({ path: p, override: false });
}

// Instance Winston partagée entre le module NestJS et le bootstrap (main.ts)
export const winstonInstance = createWinstonLogger();

@Global()
@Module({
  // ─── Pourquoi ne pas utiliser WinstonModule.forRoot({ instance }) ─────────────
  // nest-winston@1.10.2 a un bug dans createWinstonProviders() :
  // il appelle toujours winston.createLogger(opts) sans vérifier opts.instance,
  // ce qui crée un nouveau logger vide (sans transports) au lieu de réutiliser
  // l'instance. Solution : fournir WINSTON_MODULE_PROVIDER directement via useValue.
  providers: [
    {
      provide: WINSTON_MODULE_PROVIDER,
      useValue: winstonInstance,
    },
    AppLogger,
  ],
  exports: [WINSTON_MODULE_PROVIDER, AppLogger],
})
export class LoggerModule {}
