// Commande CQRS : inscription d'un nouvel utilisateur
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { IdGenerator } from '@shared/utils/id-generator.util';
import { UserWriteRepositoryPort } from '../../../user/application/ports/user-write-repository.port';
import { EmailAlreadyUsedError } from '../../domain/errors';
import { AuthDomainService } from '../../domain/services';
import { UserSignedUpEvent } from '../events/user-signed-up.event';
import { PasswordHasherPort } from '../ports/password-hasher.port';
import { UserAuthReadPort } from '../ports/user-auth-read.port';

export class SignupCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
    public readonly displayName: string,
  ) {}
}

export interface SignupResult {
  userId: string;
  email: string;
  displayName: string;
}

@CommandHandler(SignupCommand)
export class SignupCommandHandler implements ICommandHandler<
  SignupCommand,
  SignupResult
> {
  // Service domaine instancie directement (pas de DI, logique pure)
  private readonly authDomainService = new AuthDomainService();

  constructor(
    private readonly userAuthReadPort: UserAuthReadPort,
    private readonly passwordHasher: PasswordHasherPort,
    private readonly userWriteRepository: UserWriteRepositoryPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: SignupCommand): Promise<SignupResult> {
    const { email, password, displayName } = command;

    // Validation metier du mot de passe et du nom
    this.authDomainService.validatePassword(password);
    this.authDomainService.validateDisplayName(displayName);

    // Verifie que l'email n'est pas deja pris
    const existingUser = await this.userAuthReadPort.findByEmail(email);
    if (existingUser) {
      throw new EmailAlreadyUsedError(email);
    }

    // Hache le mot de passe et genere un id unique
    const passwordHash = await this.passwordHasher.hash(password);
    const userId = IdGenerator.generate();

    await this.userWriteRepository.create({
      id: userId,
      email,
      passwordHash,
      displayName,
      status: 'active',
    });

    // Publie l'evenement pour notifier les autres modules
    this.eventBus.publish(new UserSignedUpEvent(userId, email, displayName));

    return { userId, email, displayName };
  }
}
