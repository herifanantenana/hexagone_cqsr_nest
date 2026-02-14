// DTO de réponse pour un post individuel
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PostResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  ownerId: string;

  @ApiProperty({ example: 'My first post' })
  title: string;

  @ApiProperty({ example: 'This is the content of my post.' })
  content: string;

  @ApiProperty({ example: 'public', enum: ['public', 'private'] })
  visibility: string;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  updatedAt: Date;
}

// DTO pour les posts dans la liste publique (inclut le nom de l'auteur)
export class PublicPostResponseDto extends PostResponseDto {
  @ApiPropertyOptional({ example: 'John Doe' })
  ownerDisplayName?: string;
}
