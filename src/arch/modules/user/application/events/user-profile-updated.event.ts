export class UserProfileUpdatedEvent {
  constructor(
    public readonly userId: string,
    public readonly displayName: string,
    public readonly bio?: string,
  ) {}
}
