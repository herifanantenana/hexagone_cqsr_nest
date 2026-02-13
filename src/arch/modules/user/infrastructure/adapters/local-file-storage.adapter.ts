import { Injectable } from '@nestjs/common';
import { IdGenerator } from '@shared/utils/id-generator.util';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  FileStoragePort,
  UploadResult,
} from '../../application/ports/file-storage.port';

@Injectable()
export class LocalFileStorageAdapter implements FileStoragePort {
  private readonly uploadsDir = path.join(process.cwd(), 'uploads');

  async upload(
    file: Express.Multer.File,
    prefix: string,
  ): Promise<UploadResult> {
    const fileExtension = path.extname(file.originalname);
    const fileName = `${IdGenerator.generate()}${fileExtension}`;
    const key = `${prefix}/${fileName}`;
    const filePath = path.join(this.uploadsDir, key);

    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // Write file
    await fs.writeFile(filePath, file.buffer);

    const url = `/uploads/${key}`;
    return { key, url };
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.uploadsDir, key);

    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
