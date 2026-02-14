// Adapter de lecture pour l'authentification
// Fournit les donnees user necessaires au module auth (email, hash, statut)

import { DrizzleService } from '@common/db/drizzle.service';
import { users } from '@common/db/schema';
import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  UserAuthReadPort,
  UserAuthSnapshot,
} from '../../../auth/application/ports/user-auth-read.port';

@Injectable()
export class UserAuthReadAdapter implements UserAuthReadPort {
  constructor(private readonly drizzle: DrizzleService) {}

  // Recherche par email pour le login
  async findByEmail(email: string): Promise<UserAuthSnapshot | null> {
    const results = await this.drizzle.db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        status: users.status,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    return results[0];
  }

  // Recherche par ID pour la validation de session/token
  async findById(id: string): Promise<UserAuthSnapshot | null> {
    const results = await this.drizzle.db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        status: users.status,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    return results[0];
  }
}
