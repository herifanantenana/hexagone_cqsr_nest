import { AuthThrottle } from '@common/interface/http/decorators';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { UserPrincipal } from '@shared/types/user-principal.type';
import { Request } from 'express';
import { ChangePasswordCommand } from '../../../application/commands/change-password.command';
import { LoginCommand } from '../../../application/commands/login.command';
import { LogoutCommand } from '../../../application/commands/logout.command';
import { RefreshTokenCommand } from '../../../application/commands/refresh-token.command';
import { SignupCommand } from '../../../application/commands/signup.command';
import { CurrentUser } from '../decorators/current-user.decorator';
import { AuthResponseDto } from '../dtos/auth-response.dto';
import { ChangePasswordDto } from '../dtos/change-password.dto';
import { LoginDto } from '../dtos/login.dto';
import { SignupDto } from '../dtos/signup.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('signup')
  @AuthThrottle() // Rate limit strict : 5 req/min par IP (anti brute-force inscription)
  @HttpCode(HttpStatus.CREATED)
  async signup(
    @Body() dto: SignupDto,
  ): Promise<{ userId: string; email: string; displayName: string }> {
    return this.commandBus.execute<
      SignupCommand,
      { userId: string; email: string; displayName: string }
    >(new SignupCommand(dto.email, dto.password, dto.displayName));
  }

  @Post('login')
  @AuthThrottle() // Rate limit strict : 5 req/min par IP (anti brute-force credentials)
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    const userAgent = req.headers['user-agent'];
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';

    const result = await this.commandBus.execute<
      LoginCommand,
      Omit<AuthResponseDto, 'tokenType'>
    >(new LoginCommand(dto.email, dto.password, userAgent, ip));

    return {
      ...result,
      tokenType: 'Bearer',
    };
  }

  @Post('refresh')
  @AuthThrottle() // Rate limit strict : 5 req/min (évite l'abus de token rotation)
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body('refreshToken') refreshToken: string,
  ): Promise<AuthResponseDto> {
    const result = await this.commandBus.execute<
      RefreshTokenCommand,
      Omit<AuthResponseDto, 'tokenType'>
    >(new RefreshTokenCommand(refreshToken));

    return {
      ...result,
      tokenType: 'Bearer',
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: UserPrincipal): Promise<void> {
    await this.commandBus.execute<LogoutCommand, void>(
      new LogoutCommand(user.userId),
    );
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() user: UserPrincipal,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.commandBus.execute<ChangePasswordCommand, void>(
      new ChangePasswordCommand(
        user.userId,
        dto.currentPassword,
        dto.newPassword,
      ),
    );
  }
}
