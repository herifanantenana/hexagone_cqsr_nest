// Controller HTTP du module User
// Situé dans Interface car c'est la porte d'entrée HTTP vers les commandes/queries CQRS user
import { UploadThrottle } from '@common/interface/http/decorators';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserPrincipal } from '@shared/types/user-principal.type';
import { CurrentUser } from '../../../../auth/interface/http/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../auth/interface/http/guards/jwt-auth.guard';
import { DeleteAvatarCommand } from '../../../application/commands/delete-avatar.command';
import { UpdateProfileCommand } from '../../../application/commands/update-profile.command';
import { UploadAvatarCommand } from '../../../application/commands/upload-avatar.command';
import { GetMyProfileQuery } from '../../../application/queries/get-my-profile.query';
import { GetPublicProfileQuery } from '../../../application/queries/get-public-profile.query';
import { avatarMulterConfig } from '../config/avatar-multer.config';
import { ProfileResponseDto } from '../dtos/profile-response.dto';
import { PublicProfileResponseDto } from '../dtos/public-profile-response.dto';
import { UpdateProfileDto } from '../dtos/update-profile.dto';

@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my profile (authenticated user)' })
  @ApiResponse({
    status: 200,
    description: 'Profile returned',
    type: ProfileResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyProfile(
    @CurrentUser() user: UserPrincipal,
  ): Promise<ProfileResponseDto> {
    return this.queryBus.execute<GetMyProfileQuery, ProfileResponseDto>(
      new GetMyProfileQuery(user.userId),
    );
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get public profile of a user' })
  @ApiParam({
    name: 'userId',
    type: 'string',
    format: 'uuid',
    description: 'User UUID',
  })
  @ApiResponse({
    status: 200,
    description: 'Public profile returned',
    type: PublicProfileResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getPublicProfile(
    @Param('userId') userId: string,
  ): Promise<PublicProfileResponseDto> {
    return this.queryBus.execute<
      GetPublicProfileQuery,
      PublicProfileResponseDto
    >(new GetPublicProfileQuery(userId));
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update my profile' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({
    status: 200,
    description: 'Profile updated',
    type: ProfileResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateProfile(
    @CurrentUser() user: UserPrincipal,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    return this.commandBus.execute<UpdateProfileCommand, ProfileResponseDto>(
      new UpdateProfileCommand(user.userId, dto.displayName, dto.bio),
    );
  }

  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @UploadThrottle() // Rate limit upload : 10 req/min par userId (évite le spam de fichiers)
  @UseInterceptors(FileInterceptor('avatar', avatarMulterConfig))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload avatar image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'Avatar image (JPEG/PNG, max 2 MB)',
        },
      },
      required: ['avatar'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Avatar uploaded',
    type: ProfileResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file type or file too large',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async uploadAvatar(
    @CurrentUser() user: UserPrincipal,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ProfileResponseDto> {
    if (!file) {
      throw new Error('No file uploaded');
    }

    return this.commandBus.execute<UploadAvatarCommand, ProfileResponseDto>(
      new UploadAvatarCommand(user.userId, file),
    );
  }

  @Delete('me/avatar')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete avatar image' })
  @ApiResponse({ status: 204, description: 'Avatar deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteAvatar(@CurrentUser() user: UserPrincipal): Promise<void> {
    await this.commandBus.execute<DeleteAvatarCommand, void>(
      new DeleteAvatarCommand(user.userId),
    );
  }
}
