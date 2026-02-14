import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DrizzleService } from './drizzle.service';

// @Global : DrizzleService injectable partout sans importer DrizzleModule à chaque fois
@Global()
@Module({
  imports: [ConfigModule],
  providers: [DrizzleService],
  exports: [DrizzleService],
})
export class DrizzleModule {}
