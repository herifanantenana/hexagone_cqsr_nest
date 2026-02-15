// DTO de reponse pour une conversation
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConversationResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' })
  createdBy: string;

  @ApiPropertyOptional({ example: 'Project Discussion', nullable: true })
  title: string | null;

  @ApiProperty({ example: '2025-01-15T10:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({
    description: 'UUIDs des membres',
    example: ['b2c3d4e5-f6a7-8901-bcde-f12345678901'],
    type: [String],
  })
  members: string[];
}

// Version enrichie pour la liste (avec dernier message)
export class ConversationListItemDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' })
  createdBy: string;

  @ApiPropertyOptional({ example: 'Project Discussion', nullable: true })
  title: string | null;

  @ApiProperty({ example: '2025-01-15T10:30:00.000Z' })
  createdAt: Date;

  @ApiPropertyOptional({ example: 'Hello!', nullable: true })
  lastMessageContent: string | null;

  @ApiPropertyOptional({ example: '2025-01-15T11:00:00.000Z', nullable: true })
  lastMessageAt: Date | null;

  @ApiProperty({ example: 3 })
  memberCount: number;
}

// Detail d'une conversation (avec liste des membres)
export class ConversationDetailResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' })
  createdBy: string;

  @ApiPropertyOptional({ example: 'Project Discussion', nullable: true })
  title: string | null;

  @ApiProperty({ example: '2025-01-15T10:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-01-15T10:30:00.000Z' })
  updatedAt: Date;

  @ApiProperty({
    description: 'Liste des membres avec leur date de join',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        },
        joinedAt: { type: 'string', example: '2025-01-15T10:30:00.000Z' },
      },
    },
  })
  members: { userId: string; joinedAt: Date }[];
}
