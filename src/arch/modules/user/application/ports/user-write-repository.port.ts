import { User } from '../../domain/models/user.model';

export interface CreateUserData {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  status: string;
}

export abstract class UserWriteRepositoryPort {
  abstract create(data: CreateUserData): Promise<void>;
  abstract update(user: User): Promise<void>;
  abstract findById(userId: string): Promise<User | null>;
  abstract findByEmail(email: string): Promise<User | null>;
}
