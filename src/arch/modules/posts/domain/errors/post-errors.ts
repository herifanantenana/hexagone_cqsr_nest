// Erreurs métier du domaine Posts
// Chaque erreur a un nom unique utilisé par GlobalExceptionFilter pour le mapping HTTP

export class PostNotFoundError extends Error {
  constructor(postId: string) {
    super(`Post not found: ${postId}`);
    this.name = 'PostNotFoundError';
  }
}

// Accès interdit : utilisateur non-owner tente de lire un post private ou de modifier
export class ForbiddenPostAccessError extends Error {
  constructor(message?: string) {
    super(message || 'You do not have access to this post');
    this.name = 'ForbiddenPostAccessError';
  }
}

// Données de post invalides (titre trop court, contenu vide, etc.)
export class InvalidPostDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPostDataError';
  }
}
