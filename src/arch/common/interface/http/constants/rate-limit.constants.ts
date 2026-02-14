// Noms des throttlers nommés (utilisés dans ThrottlerModule config et les decorators)
export const THROTTLER_GLOBAL = 'global'; // 120 req/min — appliqué partout
export const THROTTLER_AUTH = 'auth'; // 5 req/min — opt-in via @AuthThrottle()
export const THROTTLER_UPLOAD = 'upload'; // 10 req/min — opt-in via @UploadThrottle()

// Clé metadata custom pour marquer un endpoint comme opt-in sur un throttler
// Utilisée dans RateLimitGuard.canActivate() pour filtrer les throttlers actifs
export const THROTTLE_ENABLED_KEY = 'rate-limit:enabled:';
