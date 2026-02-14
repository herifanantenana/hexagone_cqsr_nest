// Configuration Multer pour l'upload d'avatar
// Stocke en memoire (buffer) avant traitement par le command handler

import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';

export const avatarMulterConfig: MulterOptions = {
  // Stockage en memoire pour acceder au buffer dans le handler
  storage: memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // Limite a 2MB
  },
  // Filtre les types MIME acceptes cote HTTP (avant le domaine)
  fileFilter: (req, file, callback) => {
    const allowedMimetypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowedMimetypes.includes(file.mimetype)) {
      callback(
        new BadRequestException(
          'Invalid file type. Only JPEG, PNG, and WebP are allowed',
        ),
        false,
      );
      return;
    }

    callback(null, true);
  },
};
