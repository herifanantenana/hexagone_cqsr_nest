// DTO de création de post (validé par ValidationPipe + documenté par Swagger)
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePostDto {
  @ApiProperty({ example: 'My first post', minLength: 3, maxLength: 255 })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title: string;

  @ApiProperty({ example: 'This is the content of my post.' })
  @IsString()
  @MinLength(1)
  content: string;

  @ApiPropertyOptional({
    example: 'public',
    enum: ['public', 'private'],
    default: 'public',
    description:
      "'public' = visible par tous, 'private' = visible par l'owner uniquement",
  })
  @IsOptional()
  @IsString()
  @IsIn(['public', 'private'])
  visibility?: string = 'public';
}
