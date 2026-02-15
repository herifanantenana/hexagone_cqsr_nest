// Guard WebSocket : valide le JWT fourni dans le handshake
// Le client socket.io envoie le token dans auth.token ou en query param
// Si valide → attache le UserPrincipal sur client.data.user
// Si invalide → refuse la connexion
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { UserPrincipal } from '@shared/types/user-principal.type';
import { Socket } from 'socket.io';
import { TokenPort } from '../../../../auth/application/ports/token.port';

// Type-safe wrapper for socket.data (Socket.IO stores custom data here)
interface WsSocketData {
  user?: UserPrincipal;
}

@Injectable()
export class WsJwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtAuthGuard.name);

  constructor(private readonly tokenPort: TokenPort) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<Socket>();

    // Recupere le token depuis le handshake (auth.token ou query.token)
    const token =
      (client.handshake.auth as Record<string, string>)?.token ||
      (client.handshake.query as Record<string, string>)?.token;

    if (!token) {
      this.logger.warn('WS connection rejected: no token provided');
      client.disconnect();
      return false;
    }

    try {
      // Verifie le JWT et extrait le payload
      const payload = this.tokenPort.verifyAccessToken(token);

      // Attache le principal sur le socket pour les handlers suivants
      const principal: UserPrincipal = {
        userId: payload.sub,
        email: payload.email,
        status: 'active',
        permissions: payload.permissions || [],
      };

      (client.data as WsSocketData).user = principal;
      return true;
    } catch {
      this.logger.warn('WS connection rejected: invalid token');
      client.disconnect();
      return false;
    }
  }
}
