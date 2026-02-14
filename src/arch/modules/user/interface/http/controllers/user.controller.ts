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

@Controller('users')
export class UserController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyProfile(
    @CurrentUser() user: UserPrincipal,
  ): Promise<ProfileResponseDto> {
    return this.queryBus.execute<GetMyProfileQuery, ProfileResponseDto>(
      new GetMyProfileQuery(user.userId),
    );
  }

  @Get(':userId')
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
  async deleteAvatar(@CurrentUser() user: UserPrincipal): Promise<void> {
    await this.commandBus.execute<DeleteAvatarCommand, void>(
      new DeleteAvatarCommand(user.userId),
    );
  }
}
