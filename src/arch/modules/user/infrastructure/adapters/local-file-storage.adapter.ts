// Adapter de stockage fichiers en local (systeme de fichiers)
// Stocke les fichiers dans le dossier "uploads/" a la racine du projet

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
    // Genere un nom de fichier unique avec l'extension d'origine
    const fileExtension = path.extname(file.originalname);
    const fileName = `${IdGenerator.generate()}${fileExtension}`;
    const key = `${prefix}/${fileName}`;
    const filePath = path.join(this.uploadsDir, key);

    // Cree le dossier si necessaire
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // Ecrit le buffer en memoire sur le disque
    await fs.writeFile(filePath, file.buffer);

    // Retourne une URL relative pour servir le fichier en statique
    const url = `/uploads/${key}`;
    return { key, url };
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.uploadsDir, key);

    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore l'erreur si le fichier n'existe pas
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
