// DTO pour l'ajout d'un membre a une conversation
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AddMemberDto {
  @ApiProperty({
    description: 'UUID du user a ajouter comme membre',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID('4')
  userId: string;
}
