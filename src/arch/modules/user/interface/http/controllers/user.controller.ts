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
import { DeleteAvatarCommand } from '../../../application/commands/delete-avatar.command';
import { UpdateProfileCommand } from '../../../application/commands/update-profile.command';
import { UploadAvatarCommand } from '../../../application/commands/upload-avatar.command';
import { GetMyProfileQuery } from '../../../application/queries/get-my-profile.query';
import { GetPublicProfileQuery } from '../../../application/queries/get-public-profile.query';
import { CurrentUser } from '../../../../auth/interface/http/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../auth/interface/http/guards/jwt-auth.guard';
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
  async getMyProfile(@CurrentUser() user: UserPrincipal): Promise<ProfileResponseDto> {
    const result = await this.queryBus.execute(
      new GetMyProfileQuery(user.userId),
    );
    return result;
  }

  @Get(':userId')
  async getPublicProfile(
    @Param('userId') userId: string,
  ): Promise<PublicProfileResponseDto> {
    const result = await this.queryBus.execute(
      new GetPublicProfileQuery(userId),
    );
    return result;
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @CurrentUser() user: UserPrincipal,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    const result = await this.commandBus.execute(
      new UpdateProfileCommand(user.userId, dto.displayName, dto.bio),
    );
    return result;
  }

  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('avatar', avatarMulterConfig))
  async uploadAvatar(
    @CurrentUser() user: UserPrincipal,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ProfileResponseDto> {
    if (!file) {
      throw new Error('No file uploaded');
    }

    const result = await this.commandBus.execute(
      new UploadAvatarCommand(user.userId, file),
    );
    return result;
  }

  @Delete('me/avatar')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAvatar(@CurrentUser() user: UserPrincipal): Promise<void> {
    await this.commandBus.execute(new DeleteAvatarCommand(user.userId));
  }
}
