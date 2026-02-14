// Port de lecture des donnees utilisateur pour l'authentification

// Snapshot minimal de l'utilisateur necessaire pour l'auth
export interface UserAuthSnapshot {
  id: string;
  email: string;
  passwordHash: string;
  status: string;
}

// Port abstrait : permet au module auth de lire les users sans dependre de l'infra
export abstract class UserAuthReadPort {
  abstract findByEmail(email: string): Promise<UserAuthSnapshot | null>;
  abstract findById(id: string): Promise<UserAuthSnapshot | null>;
}
