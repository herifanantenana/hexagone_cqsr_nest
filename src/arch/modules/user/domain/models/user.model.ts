// Agregat User : entite racine du domaine utilisateur

import { Email } from '../value-objects/email.vo';
import { UserStatus } from '../value-objects/user-status.vo';

// Proprietes internes de l'agregat User
export interface UserProps {
  id: string;
  email: Email;
  passwordHash: string;
  displayName: string;
  bio?: string;
  avatarKey?: string;
  avatarUrl?: string;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  private constructor(private props: UserProps) {}

  // Cree un nouvel utilisateur
  static create(props: UserProps): User {
    return new User(props);
  }

  // Reconstruit un user depuis la base de donnees
  static reconstitute(props: UserProps): User {
    return new User(props);
  }

  // --- Accesseurs en lecture seule ---

  getId(): string {
    return this.props.id;
  }

  getEmail(): Email {
    return this.props.email;
  }

  getPasswordHash(): string {
    return this.props.passwordHash;
  }

  getDisplayName(): string {
    return this.props.displayName;
  }

  getBio(): string | undefined {
    return this.props.bio;
  }

  getAvatarKey(): string | undefined {
    return this.props.avatarKey;
  }

  getAvatarUrl(): string | undefined {
    return this.props.avatarUrl;
  }

  getStatus(): UserStatus {
    return this.props.status;
  }

  getCreatedAt(): Date {
    return this.props.createdAt;
  }

  getUpdatedAt(): Date {
    return this.props.updatedAt;
  }

  // --- Methodes de mutation du domaine ---

  // Met a jour le nom d'affichage et la bio
  updateProfile(displayName: string, bio?: string): void {
    if (displayName && displayName.trim().length > 0) {
      this.props.displayName = displayName.trim();
    }
    this.props.bio = bio;
    this.props.updatedAt = new Date();
  }

  updatePassword(passwordHash: string): void {
    this.props.passwordHash = passwordHash;
    this.props.updatedAt = new Date();
  }

  // Associe un avatar (cle de stockage + URL publique)
  setAvatar(avatarKey: string, avatarUrl: string): void {
    this.props.avatarKey = avatarKey;
    this.props.avatarUrl = avatarUrl;
    this.props.updatedAt = new Date();
  }

  removeAvatar(): void {
    this.props.avatarKey = undefined;
    this.props.avatarUrl = undefined;
    this.props.updatedAt = new Date();
  }

  // --- Gestion du statut ---

  deactivate(): void {
    this.props.status = UserStatus.inactive();
    this.props.updatedAt = new Date();
  }

  activate(): void {
    this.props.status = UserStatus.active();
    this.props.updatedAt = new Date();
  }

  ban(): void {
    this.props.status = UserStatus.banned();
    this.props.updatedAt = new Date();
  }
}
