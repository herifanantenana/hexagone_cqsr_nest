// DTO de validation pour la mise a jour du profil (valide via class-validator)

import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  displayName: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;
}
