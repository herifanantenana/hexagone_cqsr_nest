import { DrizzleModule } from '@common/db/drizzle.module';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

// Controllers
import { UserController } from './interface/http/controllers/user.controller';

// Command Handlers
import { DeleteAvatarCommandHandler } from './application/commands/delete-avatar.command';
import { UpdateProfileCommandHandler } from './application/commands/update-profile.command';
import { UploadAvatarCommandHandler } from './application/commands/upload-avatar.command';

// Query Handlers
import { FindUserByEmailQueryHandler } from './application/queries/find-user-by-email.query';
import { GetMyProfileQueryHandler } from './application/queries/get-my-profile.query';
import { GetPublicProfileQueryHandler } from './application/queries/get-public-profile.query';

// Adapters
import { LocalFileStorageAdapter } from './infrastructure/adapters/local-file-storage.adapter';
import { UserAuthReadAdapter } from './infrastructure/adapters/user-auth-read.adapter';
import { UserRepositoryAdapter } from './infrastructure/adapters/user-repository.adapter';
import { UserWriteRepositoryAdapter } from './infrastructure/adapters/user-write-repository.adapter';

// Ports
import { UserAuthReadPort } from '../auth/application/ports/user-auth-read.port';
import { FileStoragePort } from './application/ports/file-storage.port';
import { UserRepositoryPort } from './application/ports/user-repository.port';
import { UserWriteRepositoryPort } from './application/ports/user-write-repository.port';

const commandHandlers = [
  UpdateProfileCommandHandler,
  UploadAvatarCommandHandler,
  DeleteAvatarCommandHandler,
];

const queryHandlers = [
  GetMyProfileQueryHandler,
  GetPublicProfileQueryHandler,
  FindUserByEmailQueryHandler,
];

const adapters = [
  {
    provide: UserRepositoryPort,
    useClass: UserRepositoryAdapter,
  },
  {
    provide: UserWriteRepositoryPort,
    useClass: UserWriteRepositoryAdapter,
  },
  {
    provide: FileStoragePort,
    useClass: LocalFileStorageAdapter,
  },
  {
    provide: UserAuthReadPort,
    useClass: UserAuthReadAdapter,
  },
];

@Module({
  imports: [CqrsModule, DrizzleModule],
  controllers: [UserController],
  providers: [...commandHandlers, ...queryHandlers, ...adapters],
  exports: [UserAuthReadPort, UserWriteRepositoryPort], // Export for Auth module
})
export class UserModule {}
