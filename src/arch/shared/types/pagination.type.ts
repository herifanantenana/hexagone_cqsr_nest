// Type générique pour les réponses paginées (utilisé par les queries de liste)
// Réutilisable pour posts, users, comments, etc.
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
