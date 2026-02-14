// Port du repository posts : contrat abstrait entre Application et Infrastructure
// Les handlers CQRS dépendent de ce port, jamais de l'implémentation Drizzle
// L'adapter concret est injecté via le module NestJS (provide/useClass)

import { Post } from '../../domain/models/post.model';

// Snapshot pour les listes publiques (inclut le nom de l'auteur)
export interface PublicPostSnapshot {
  id: string;
  ownerId: string;
  title: string;
  content: string;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
  ownerDisplayName: string;
}

// Données nécessaires pour créer un post en base
export interface CreatePostData {
  id: string;
  ownerId: string;
  title: string;
  content: string;
  visibility: string;
}

export abstract class PostRepositoryPort {
  abstract findById(id: string): Promise<Post | null>;
  abstract findPublicPosts(
    page: number,
    pageSize: number,
  ): Promise<{ data: PublicPostSnapshot[]; total: number }>;
  abstract create(data: CreatePostData): Promise<void>;
  abstract update(post: Post): Promise<void>;
  abstract delete(id: string): Promise<void>;
}
