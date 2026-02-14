// Value Object representant le statut d'un utilisateur (active, inactive, banned)

// Types de statut autorises
export type UserStatusValue = 'active' | 'inactive' | 'banned';

export class UserStatus {
  // Constructeur prive : on passe toujours par les factory methods
  private constructor(private readonly value: UserStatusValue) {}

  // Cree un statut a partir d'une chaine, avec validation
  static create(status: string): UserStatus {
    const normalizedStatus = status.toLowerCase();

    if (!['active', 'inactive', 'banned'].includes(normalizedStatus)) {
      throw new Error(`Invalid user status: ${status}`);
    }

    return new UserStatus(normalizedStatus as UserStatusValue);
  }

  // Factory methods pour chaque statut possible
  static active(): UserStatus {
    return new UserStatus('active');
  }

  static inactive(): UserStatus {
    return new UserStatus('inactive');
  }

  static banned(): UserStatus {
    return new UserStatus('banned');
  }

  getValue(): UserStatusValue {
    return this.value;
  }

  isActive(): boolean {
    return this.value === 'active';
  }

  // Comparaison par valeur (principe des Value Objects)
  equals(other: UserStatus): boolean {
    return this.value === other.value;
  }
}
