// DTO de validation pour le changement de mot de passe
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8) // Nouveau mot de passe : min 8 caracteres
  newPassword: string;
}
