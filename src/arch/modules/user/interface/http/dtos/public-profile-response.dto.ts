// DTO de reponse pour le profil public (visible par tous les utilisateurs)

export class PublicProfileResponseDto {
  id: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  createdAt: Date;
}
