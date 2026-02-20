// Controller HTTP du module Auth
// Situé dans Interface car c'est la porte d'entrée HTTP vers les commandes CQRS auth
import { AppLogger } from '@common/infra/logger';
import { AuthThrottle, Can } from '@common/interface/http/decorators';
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
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger: AppLogger;

  constructor(
    private readonly commandBus: CommandBus,
    appLogger: AppLogger,
  ) {
    this.logger = appLogger.withContext('Auth');
  }

  @Post('signup')
  @AuthThrottle()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: SignupDto })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid data (password too weak, etc.)',
  })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async signup(
    @Body() dto: SignupDto,
    @Req() req: Request,
  ): Promise<{ userId: string; email: string; displayName: string }> {
    const requestId = req.headers['x-request-id'] as string;
    const result = await this.commandBus.execute<
      SignupCommand,
      { userId: string; email: string; displayName: string }
    >(new SignupCommand(dto.email, dto.password, dto.displayName));

    // On ne log jamais le mot de passe ni le token
    this.logger.log('Signup success', {
      requestId,
      userId: result.userId,
      email: result.email,
    });
    return result;
  }

  @Post('login')
  @AuthThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    const userAgent = req.headers['user-agent'];
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const requestId = req.headers['x-request-id'] as string;

    try {
      const result = await this.commandBus.execute<
        LoginCommand,
        Omit<AuthResponseDto, 'tokenType'>
      >(new LoginCommand(dto.email, dto.password, userAgent, ip));

      // On ne log jamais le mot de passe ni les tokens
      this.logger.log('Login success', {
        requestId,
        email: dto.email,
        ip,
      });

      return {
        ...result,
        tokenType: 'Bearer',
      };
    } catch (error) {
      // Log de l'échec sans infos sensibles
      this.logger.warn('Login failed', {
        requestId,
        email: dto.email,
        ip,
      });
      throw error;
    }
  }

  @Post('refresh')
  @AuthThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiBody({
    schema: {
      properties: { refreshToken: { type: 'string', example: 'a1b2c3d4-...' } },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Tokens refreshed',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async refresh(
    @Body('refreshToken') refreshToken: string,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    const requestId = req.headers['x-request-id'] as string;

    try {
      const result = await this.commandBus.execute<
        RefreshTokenCommand,
        Omit<AuthResponseDto, 'tokenType'>
      >(new RefreshTokenCommand(refreshToken));

      // On ne log jamais le refresh token
      this.logger.log('Token refresh success', { requestId });
      return {
        ...result,
        tokenType: 'Bearer',
      };
    } catch (error) {
      this.logger.warn('Token refresh failed', { requestId });
      throw error;
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @Can('user', 'read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Logout (revoke session)' })
  @ApiResponse({ status: 204, description: 'Logged out' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Missing permission' })
  async logout(
    @CurrentUser() user: UserPrincipal,
    @Req() req: Request,
  ): Promise<void> {
    await this.commandBus.execute<LogoutCommand, void>(
      new LogoutCommand(user.userId),
    );
    this.logger.log('Logout success', {
      requestId: req.headers['x-request-id'] as string,
      userId: user.userId,
    });
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @Can('user', 'update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Change password (revokes all sessions)' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 204, description: 'Password changed' })
  @ApiResponse({
    status: 400,
    description: 'New password does not meet requirements',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized or current password incorrect',
  })
  async changePassword(
    @CurrentUser() user: UserPrincipal,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ): Promise<void> {
    const requestId = req.headers['x-request-id'] as string;

    try {
      await this.commandBus.execute<ChangePasswordCommand, void>(
        new ChangePasswordCommand(
          user.userId,
          dto.currentPassword,
          dto.newPassword,
        ),
      );
      // On ne log jamais les mots de passe
      this.logger.log('Password changed', {
        requestId,
        userId: user.userId,
      });
    } catch (error) {
      this.logger.warn('Change password failed', {
        requestId,
        userId: user.userId,
      });
      throw error;
    }
  }
}
