import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  InvalidCredentialsError,
  UserDisabledError,
} from '../../domain/errors';
import { PasswordHasherPort } from '../ports/password-hasher.port';
import { UserAuthReadPort } from '../ports/user-auth-read.port';

export class ValidateCredentialsQuery {
  constructor(
    public readonly email: string,
    public readonly password: string,
  ) {}
}

export interface ValidateCredentialsResult {
  userId: string;
  email: string;
}

@QueryHandler(ValidateCredentialsQuery)
export class ValidateCredentialsQueryHandler implements IQueryHandler<
  ValidateCredentialsQuery,
  ValidateCredentialsResult
> {
  constructor(
    private readonly userAuthReadPort: UserAuthReadPort,
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(
    query: ValidateCredentialsQuery,
  ): Promise<ValidateCredentialsResult> {
    const { email, password } = query;

    const user = await this.userAuthReadPort.findByEmail(email);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    const isPasswordValid = await this.passwordHasher.compare(
      password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new InvalidCredentialsError();
    }

    if (user.status !== 'active') {
      throw new UserDisabledError();
    }

    return {
      userId: user.id,
      email: user.email,
    };
  }
}
