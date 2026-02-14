import { applyDecorators, SetMetadata } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import {
  THROTTLE_ENABLED_KEY,
  THROTTLER_AUTH,
  THROTTLER_GLOBAL,
  THROTTLER_UPLOAD,
} from '../constants/rate-limit.constants';

// Active le throttler "auth" (5 req/min) sur la route décorée.
// SetMetadata → flag opt-in lu par RateLimitGuard.canActivate()
// Throttle → enregistre le throttler dans les metadata de @nestjs/throttler
export const AuthThrottle = () =>
  applyDecorators(
    SetMetadata(THROTTLE_ENABLED_KEY + THROTTLER_AUTH, true),
    Throttle({ [THROTTLER_AUTH]: {} }), // {} = utilise les valeurs par défaut du module
  );

// Active le throttler "upload" (10 req/min) sur la route décorée.
// Même mécanisme opt-in que AuthThrottle
export const UploadThrottle = () =>
  applyDecorators(
    SetMetadata(THROTTLE_ENABLED_KEY + THROTTLER_UPLOAD, true),
    Throttle({ [THROTTLER_UPLOAD]: {} }),
  );

// Désactive TOUS les throttlers sur la route/controller (health check, etc.).
// En v6, SkipThrottle() sans args ne skip rien → il faut nommer chaque throttler
export const SkipAllThrottle = () =>
  SkipThrottle({
    [THROTTLER_GLOBAL]: true,
    [THROTTLER_AUTH]: true,
    [THROTTLER_UPLOAD]: true,
  });

export { SkipThrottle };
