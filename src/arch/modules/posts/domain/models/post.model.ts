// Agrégat Post : entité racine du domaine posts
// Contient la logique de mutation et les invariants métier
// Ne dépend d'aucun framework (NestJS, Drizzle, etc.) → pur domaine

import { PostVisibility } from '../value-objects/post-visibility.vo';

export interface PostProps {
  id: string;
  ownerId: string;
  title: string;
  content: string;
  visibility: PostVisibility;
  createdAt: Date;
  updatedAt: Date;
}

export class Post {
  private constructor(private props: PostProps) {}

  // Factory pour créer un nouveau post
  static create(props: PostProps): Post {
    return new Post(props);
  }

  // Factory pour reconstruire depuis la base de données
  static reconstitute(props: PostProps): Post {
    return new Post(props);
  }

  // ─── Accesseurs (lecture seule) ──────────────────────────────────────────

  getId(): string {
    return this.props.id;
  }

  getOwnerId(): string {
    return this.props.ownerId;
  }

  getTitle(): string {
    return this.props.title;
  }

  getContent(): string {
    return this.props.content;
  }

  getVisibility(): PostVisibility {
    return this.props.visibility;
  }

  isPublic(): boolean {
    return this.props.visibility.isPublic();
  }

  getCreatedAt(): Date {
    return this.props.createdAt;
  }

  getUpdatedAt(): Date {
    return this.props.updatedAt;
  }

  // ─── Mutations ───────────────────────────────────────────────────────────

  update(title: string, content: string, visibility?: PostVisibility): void {
    if (title && title.trim().length > 0) {
      this.props.title = title.trim();
    }
    if (content && content.trim().length > 0) {
      this.props.content = content.trim();
    }
    if (visibility) {
      this.props.visibility = visibility;
    }
    this.props.updatedAt = new Date();
  }
}
