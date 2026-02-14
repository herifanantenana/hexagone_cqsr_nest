// Décorateur @Can(resource, action) : déclare la permission requise pour accéder à un endpoint
// Fonctionne avec PermissionsGuard qui lit ce metadata pour autoriser/refuser
// Exemple : @Can('posts', 'create') → l'utilisateur doit avoir { resource: 'posts', actions: ['create'] }
import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSION_KEY = 'required_permission';

export interface RequiredPermission {
  resource: string;
  action: string;
}

export const Can = (resource: string, action: string) =>
  SetMetadata(REQUIRED_PERMISSION_KEY, {
    resource,
    action,
  } as RequiredPermission);
