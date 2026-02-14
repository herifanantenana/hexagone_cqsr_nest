// DTO de validation pour le changement de mot de passe (class-validator + Swagger)
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'Password123!' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ example: 'NewPassword456!', minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
