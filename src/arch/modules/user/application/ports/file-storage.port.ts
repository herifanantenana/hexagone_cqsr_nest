// Port abstrait pour le stockage de fichiers (avatar, etc.)
// L'implementation concrete peut etre locale, S3, etc.

// Resultat d'un upload : cle de stockage + URL publique
export interface UploadResult {
  key: string;
  url: string;
}

export abstract class FileStoragePort {
  abstract upload(
    file: Express.Multer.File,
    prefix: string,
  ): Promise<UploadResult>;
  abstract delete(key: string): Promise<void>;
}
