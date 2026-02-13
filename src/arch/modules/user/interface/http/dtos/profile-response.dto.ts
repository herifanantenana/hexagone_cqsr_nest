export class ProfileResponseDto {
  id: string;
  email: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
