// Value Object representant un email avec validation de format

export class Email {
  // Constructeur prive : on passe par la factory method create()
  private constructor(private readonly value: string) {}

  // Cree un email valide, normalise en minuscules
  static create(email: string): Email {
    if (!email || email.trim().length === 0) {
      throw new Error('Email is required');
    }

    // Validation basique du format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    return new Email(email.toLowerCase().trim());
  }

  getValue(): string {
    return this.value;
  }

  // Comparaison par valeur (principe des Value Objects)
  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
