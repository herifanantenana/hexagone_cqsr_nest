// DTO de reponse pour les endpoints d'authentification (login, refresh)
export class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // Duree de vie de l'access token en secondes
  tokenType: string = 'Bearer';
}
