// DTO de réponse paginée (enveloppe générique pour les listes)
import { ApiProperty } from '@nestjs/swagger';
import { PublicPostResponseDto } from './post-response.dto';

export class PaginatedPostsResponseDto {
  @ApiProperty({ type: [PublicPostResponseDto] })
  data: PublicPostResponseDto[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}
