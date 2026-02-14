import { v4 as uuidv4 } from 'uuid';

// Utilitaire partagé pour générer et valider des UUID v4
export class IdGenerator {
  static generate(): string {
    return uuidv4();
  }

  static isValid(id: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }
}
