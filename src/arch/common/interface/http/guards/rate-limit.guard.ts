import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import {
  THROTTLE_ENABLED_KEY,
  THROTTLER_GLOBAL,
} from '../constants/rate-limit.constants';

// Guard custom qui étend ThrottlerGuard :
// - Rend auth/upload opt-in (actifs uniquement sur les endpoints décorés)
// - Track par userId si authentifié, sinon par IP réelle
// - Gère l'IP derrière un reverse proxy (TRUST_PROXY)
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  private trustProxy: boolean;

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions, // config throttlers
    @InjectThrottlerStorage() storageService: ThrottlerStorage, // storage Redis partagé
    reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    super(options, storageService, reflector);
    this.trustProxy =
      this.configService.get<string>('TRUST_PROXY', 'false') === 'true';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const classRef = context.getClass();

    // En throttler v6, TOUS les throttlers s'appliquent à chaque endpoint par défaut.
    // On filtre : "global" toujours actif, "auth"/"upload" seulement si le endpoint
    // a le metadata posé par @AuthThrottle() / @UploadThrottle()
    const allThrottlers = this.throttlers;
    this.throttlers = allThrottlers.filter((throttler) => {
      if (throttler.name === THROTTLER_GLOBAL) return true;
      // Cherche le metadata sur le handler, puis la classe
      return this.reflector.getAllAndOverride<boolean>(
        THROTTLE_ENABLED_KEY + throttler.name,
        [handler, classRef],
      );
    });

    try {
      return await super.canActivate(context);
    } finally {
      // Restaure la liste (le guard est un singleton partagé entre requêtes)
      this.throttlers = allThrottlers;
    }
  }

  // Clé de compteur Redis : "user:<id>" si authentifié, "ip:<addr>" sinon
  // Évite de pénaliser un bureau entier partageant une IP
  protected getTracker(req: Record<string, any>): Promise<string> {
    const user = req.user as { userId?: string } | undefined;
    if (user?.userId) {
      return Promise.resolve(`user:${user.userId}`);
    }
    return Promise.resolve(`ip:${this.resolveIp(req)}`);
  }

  // Résout l'IP réelle derrière un proxy via x-forwarded-for
  // Format header : "client, proxy1, proxy2" → on prend le premier
  private resolveIp(req: Record<string, any>): string {
    if (this.trustProxy) {
      const headers = req.headers as
        | Record<string, string | string[] | undefined>
        | undefined;
      const forwarded = headers?.['x-forwarded-for'];
      if (forwarded) {
        const first = Array.isArray(forwarded)
          ? forwarded[0]
          : forwarded.split(',')[0];
        return first?.trim() || 'unknown';
      }
    }
    return (
      (req.ip as string) ||
      (req.socket as { remoteAddress?: string })?.remoteAddress ||
      'unknown'
    );
  }

  // Message du body de la réponse 429
  protected getErrorMessage(): Promise<string> {
    return Promise.resolve('Too many requests. Please try again later.');
  }
}
