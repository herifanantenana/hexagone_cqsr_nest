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
