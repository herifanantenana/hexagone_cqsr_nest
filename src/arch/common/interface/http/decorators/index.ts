// Barrel export des décorateurs communs (rate limiting + permissions)
export { Can, REQUIRED_PERMISSION_KEY } from './can.decorator';
export type { RequiredPermission } from './can.decorator';
export {
  AuthThrottle,
  SkipAllThrottle,
  SkipThrottle,
  UploadThrottle,
} from './rate-limit.decorators';
