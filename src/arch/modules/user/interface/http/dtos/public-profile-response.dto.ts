// DTO de réponse pour le profil public (visible par tous)
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublicProfileResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'John Doe' })
  displayName: string;

  @ApiPropertyOptional({ example: 'Software engineer' })
  bio?: string;

  @ApiPropertyOptional({ example: '/uploads/avatar-abc123.jpg' })
  avatarUrl?: string;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  createdAt: Date;
}
