import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Middleware qui assigne un UUID unique à chaque requête
// Réutilise x-request-id si déjà présent (propagé par un reverse proxy ou le client)
// Utilisé par LoggingInterceptor pour corréler les logs d'une même requête
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = req.headers['x-request-id'] || uuidv4();
    req.headers['x-request-id'] = requestId as string;
    res.setHeader('X-Request-Id', requestId); // Retourné au client dans les headers
    next();
  }
}
