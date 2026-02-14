// DTO de mise à jour de post (tous les champs sont optionnels)
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdatePostDto {
  @ApiPropertyOptional({
    example: 'Updated title',
    minLength: 3,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ example: 'Updated content of the post.' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  content?: string;

  @ApiPropertyOptional({
    example: 'private',
    enum: ['public', 'private'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['public', 'private'])
  visibility?: string;
}
