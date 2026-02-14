// DTO de validation pour l'inscription (valide avec class-validator)
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class SignupDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8) // Longueur minimum du mot de passe
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  displayName: string;
}
