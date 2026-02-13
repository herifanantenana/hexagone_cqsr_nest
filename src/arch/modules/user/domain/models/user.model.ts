import { Email } from '../value-objects/email.vo';
import { UserStatus } from '../value-objects/user-status.vo';

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

  static create(props: UserProps): User {
    return new User(props);
  }

  static reconstitute(props: UserProps): User {
    return new User(props);
  }

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
