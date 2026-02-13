export interface UserAuthSnapshot {
  id: string;
  email: string;
  passwordHash: string;
  status: string;
}

export abstract class UserAuthReadPort {
  abstract findByEmail(email: string): Promise<UserAuthSnapshot | null>;
  abstract findById(id: string): Promise<UserAuthSnapshot | null>;
}
