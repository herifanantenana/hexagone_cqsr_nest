export type UserStatusValue = 'active' | 'inactive' | 'banned';

export class UserStatus {
  private constructor(private readonly value: UserStatusValue) {}

  static create(status: string): UserStatus {
    const normalizedStatus = status.toLowerCase();

    if (!['active', 'inactive', 'banned'].includes(normalizedStatus)) {
      throw new Error(`Invalid user status: ${status}`);
    }

    return new UserStatus(normalizedStatus as UserStatusValue);
  }

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

  equals(other: UserStatus): boolean {
    return this.value === other.value;
  }
}
