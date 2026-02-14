// Port abstrait pour le hachage de mots de passe (implementé par bcrypt en infra)
export abstract class PasswordHasherPort {
  // Hache un mot de passe en clair
  abstract hash(password: string): Promise<string>;
  // Compare un mot de passe en clair avec son hash
  abstract compare(password: string, hash: string): Promise<boolean>;
}
