// Adapter infra : implementation du port PasswordHasher avec bcryptjs
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PasswordHasherPort } from '../../application/ports/password-hasher.port';

@Injectable()
export class BcryptPasswordHasherAdapter implements PasswordHasherPort {
  private readonly saltRounds = 10; // Nombre de tours de hachage bcrypt

  async hash(password: string): Promise<string> {
    return await bcrypt.hash(password, this.saltRounds);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }
}
