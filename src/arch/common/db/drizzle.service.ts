import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Service injectable qui gère la connexion PostgreSQL via Drizzle ORM
// OnModuleInit → la connexion est créée au démarrage du module
@Injectable()
export class DrizzleService implements OnModuleInit {
  private readonly logger = new Logger(DrizzleService.name);
  // NodePgDatabase typé avec le schema → autocomplétion des tables/colonnes
  private _db: NodePgDatabase<typeof schema>;
  private pool: Pool;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const connectionString = this.configService.get<string>('DATABASE_URL');

    if (!connectionString) {
      throw new Error('DATABASE_URL is not defined in environment variables');
    }

    // Pool de connexions pg → réutilise les connexions entre requêtes
    this.pool = new Pool({
      connectionString,
    });

    // drizzle() wrappe le pool avec le schema pour les requêtes typées
    this._db = drizzle(this.pool, { schema });
    this.logger.log('Database connection initialized');
  }

  // Getter public pour injecter db dans les repositories
  get db(): NodePgDatabase<typeof schema> {
    return this._db;
  }

  // Ferme proprement le pool à l'arrêt de l'app
  async onModuleDestroy() {
    await this.pool.end();
  }
}
