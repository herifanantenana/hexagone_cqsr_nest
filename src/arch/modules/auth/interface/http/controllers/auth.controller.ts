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
import { Request } from 'express';
import { UserPrincipal } from '@shared/types/user-principal.type';
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
  @HttpCode(HttpStatus.CREATED)
  async signup(
    @Body() dto: SignupDto,
  ): Promise<{ userId: string; email: string; displayName: string }> {
    return await this.commandBus.execute(
      new SignupCommand(dto.email, dto.password, dto.displayName),
    );
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    const userAgent = req.headers['user-agent'];
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';

    const result = await this.commandBus.execute(
      new LoginCommand(dto.email, dto.password, userAgent, ip),
    );

    return {
      ...result,
      tokenType: 'Bearer',
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body('refreshToken') refreshToken: string,
  ): Promise<AuthResponseDto> {
    const result = await this.commandBus.execute(
      new RefreshTokenCommand(refreshToken),
    );

    return {
      ...result,
      tokenType: 'Bearer',
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: UserPrincipal): Promise<void> {
    await this.commandBus.execute(new LogoutCommand(user.userId));
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() user: UserPrincipal,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new ChangePasswordCommand(
        user.userId,
        dto.currentPassword,
        dto.newPassword,
      ),
    );
  }
}
