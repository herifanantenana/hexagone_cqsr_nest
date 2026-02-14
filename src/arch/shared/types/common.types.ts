// Type Result pattern — alternative aux exceptions pour les retours métier
export type Result<T, E = Error> = Success<T> | Failure<E>;

export interface Success<T> {
  success: true;
  data: T;
}

export interface Failure<E> {
  success: false;
  error: E;
}

// Helpers pour créer des résultats typés
export const success = <T>(data: T): Success<T> => ({
  success: true,
  data,
});

export const failure = <E>(error: E): Failure<E> => ({
  success: false,
  error,
});

// Métadonnées d'un fichier uploadé (utilisé par le port FileStorage)
export interface FileUploadInfo {
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
}
