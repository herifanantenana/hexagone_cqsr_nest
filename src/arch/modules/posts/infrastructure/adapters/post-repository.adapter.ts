// Adapter infrastructure : implémente le PostRepositoryPort avec Drizzle ORM
// Gère le CRUD sur la table "posts" et la conversion vers le modèle domaine
// Ce fichier est dans Infrastructure car il dépend de Drizzle (framework d'accès DB)

import { DrizzleService } from '@common/db/drizzle.service';
import { posts, postsPublicView } from '@common/db/schema';
import { Injectable } from '@nestjs/common';
import { count, eq } from 'drizzle-orm';
import {
  CreatePostData,
  PostRepositoryPort,
  PublicPostSnapshot,
} from '../../application/ports/post-repository.port';
import { Post } from '../../domain/models/post.model';
import { PostVisibility } from '../../domain/value-objects/post-visibility.vo';

@Injectable()
export class PostRepositoryAdapter implements PostRepositoryPort {
  constructor(private readonly drizzle: DrizzleService) {}

  async findById(id: string): Promise<Post | null> {
    const results = await this.drizzle.db
      .select()
      .from(posts)
      .where(eq(posts.id, id))
      .limit(1);

    if (results.length === 0) return null;
    return this.toDomain(results[0]);
  }

  async findPublicPosts(
    page: number,
    pageSize: number,
  ): Promise<{ data: PublicPostSnapshot[]; total: number }> {
    const offset = (page - 1) * pageSize;

    // Compte total pour la pagination
    const countResult = await this.drizzle.db
      .select({ value: count() })
      .from(postsPublicView);
    const total = countResult[0]?.value ?? 0;

    // Récupère la page demandée depuis la vue publique
    const rows = await this.drizzle.db
      .select()
      .from(postsPublicView)
      .limit(pageSize)
      .offset(offset);

    const data: PublicPostSnapshot[] = rows.map((row) => ({
      id: row.id,
      ownerId: row.ownerId,
      title: row.title,
      content: row.content,
      visibility: row.visibility,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      ownerDisplayName: row.ownerDisplayName,
    }));

    return { data, total };
  }

  async create(data: CreatePostData): Promise<void> {
    await this.drizzle.db.insert(posts).values({
      id: data.id,
      ownerId: data.ownerId,
      title: data.title,
      content: data.content,
      visibility: data.visibility,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async update(post: Post): Promise<void> {
    await this.drizzle.db
      .update(posts)
      .set({
        title: post.getTitle(),
        content: post.getContent(),
        visibility: post.getVisibility().getValue(),
        updatedAt: post.getUpdatedAt(),
      })
      .where(eq(posts.id, post.getId()));
  }

  async delete(id: string): Promise<void> {
    await this.drizzle.db.delete(posts).where(eq(posts.id, id));
  }

  // Convertit une ligne SQL en agrégat domaine Post
  private toDomain(row: typeof posts.$inferSelect): Post {
    return Post.reconstitute({
      id: row.id,
      ownerId: row.ownerId,
      title: row.title,
      content: row.content,
      visibility: PostVisibility.create(row.visibility),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
