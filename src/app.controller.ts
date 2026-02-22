import { AppLogger } from '@arch/common/infra/logger';
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { SkipAllThrottle } from './arch/common/interface/http/decorators';

// Exempte ce controller de tout rate limiting (health check, root)
@SkipAllThrottle()
@ApiTags('Health')
@Controller()
export class AppController {
  private readonly logger: AppLogger;
  constructor(
    private readonly appService: AppService,
    private readonly appLogger: AppLogger,
  ) {
    this.logger = appLogger.withContext('AppController');
  }

  @Get()
  @ApiOperation({ summary: 'Root endpoint' })
  @ApiResponse({ status: 200, description: 'Returns Hello World' })
  getHello(): string {
    this.logger.debug('getHello() called', {
      context: 'AppController.getHello',
      timestamp: new Date().toISOString(),
    });
    // this.logger.info("Processing getHello() request");
    this.logger.log('This is a log message with custom level');
    this.logger.warn('This is a warning message');
    this.logger.error('This is an error message');
    this.logger.http('This is an HTTP log message');
    // this.logger.verbose("This is a verbose message");
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({
    summary: 'Health check – returns OK if the service is running',
  })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  getHealth(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
