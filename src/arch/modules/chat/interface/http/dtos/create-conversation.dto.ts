// DTO pour la creation d'une conversation
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateConversationDto {
  @ApiProperty({
    description:
      'UUIDs des membres a ajouter (le createur est ajoute automatiquement)',
    example: ['a1b2c3d4-e5f6-7890-abcd-ef1234567890'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one member is required' })
  @IsUUID('4', { each: true })
  memberIds: string[];

  @ApiPropertyOptional({
    description: 'Titre optionnel de la conversation',
    example: 'Project Discussion',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;
}
