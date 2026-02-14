// Value Object représentant la visibilité d'un post
// Encapsule la validation : seules les valeurs 'public' et 'private' sont acceptées

export type PostVisibilityValue = 'public' | 'private';

export class PostVisibility {
  private constructor(private readonly value: PostVisibilityValue) {}

  static create(value: string): PostVisibility {
    const normalized = value.toLowerCase();
    if (normalized !== 'public' && normalized !== 'private') {
      throw new Error(
        `Invalid post visibility: ${value}. Must be 'public' or 'private'.`,
      );
    }
    return new PostVisibility(normalized as PostVisibilityValue);
  }

  static public(): PostVisibility {
    return new PostVisibility('public');
  }

  static private(): PostVisibility {
    return new PostVisibility('private');
  }

  getValue(): PostVisibilityValue {
    return this.value;
  }

  isPublic(): boolean {
    return this.value === 'public';
  }

  equals(other: PostVisibility): boolean {
    return this.value === other.value;
  }
}
