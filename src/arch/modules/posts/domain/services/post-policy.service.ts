// Service domaine Posts : règles métier de visibilité et ownership
// Encapsule la logique d'autorisation qui ne dépend pas de l'infra
// Utilisé par les command/query handlers pour appliquer les règles

import {
  ForbiddenPostAccessError,
  InvalidPostDataError,
} from '../errors/post-errors';
import { Post } from '../models/post.model';

export class PostPolicyService {
  // Un post public est visible par tous
  // Un post private est visible uniquement par son owner
  canView(post: Post, requestingUserId?: string): boolean {
    if (post.isPublic()) return true;
    if (!requestingUserId) return false;
    return requestingUserId === post.getOwnerId();
  }

  // Seul l'owner peut modifier/supprimer un post
  // Lève une exception si l'utilisateur n'est pas le propriétaire
  assertCanModify(post: Post, userId: string): void {
    if (post.getOwnerId() !== userId) {
      throw new ForbiddenPostAccessError('You can only modify your own posts');
    }
  }

  // Validation des données d'un post (titre, contenu)
  validatePostData(title: string, content: string): void {
    if (!title || title.trim().length === 0) {
      throw new InvalidPostDataError('Title is required');
    }
    if (title.trim().length < 3) {
      throw new InvalidPostDataError(
        'Title must be at least 3 characters long',
      );
    }
    if (title.trim().length > 255) {
      throw new InvalidPostDataError('Title cannot exceed 255 characters');
    }
    if (!content || content.trim().length === 0) {
      throw new InvalidPostDataError('Content is required');
    }
  }
}
