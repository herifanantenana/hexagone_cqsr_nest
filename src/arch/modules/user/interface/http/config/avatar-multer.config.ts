import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';

export const avatarMulterConfig: MulterOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
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
