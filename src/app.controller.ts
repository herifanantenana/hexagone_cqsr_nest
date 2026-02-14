import { Controller, Get } from '@nestjs/common';
import { SkipAllThrottle } from './arch/common/interface/http/decorators';
import { AppService } from './app.service';

// Exempte ce controller de tout rate limiting (health check, root, etc.)
@SkipAllThrottle()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
