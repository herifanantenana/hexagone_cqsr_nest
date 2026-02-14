import { Injectable } from '@nestjs/common';

// Service racine — endpoints utilitaires (health, root)
@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}
