export type AppErrorCode = 'DATABASE' | 'VALIDATION' | 'NOT_FOUND' | 'INSUFFICIENT_STOCK' | 'NETWORK';

/** Erreur métier portant un message affichable à l'utilisateur. */
export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'AppError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, cause?: unknown) {
    super('DATABASE', message, { cause });
    this.name = 'DatabaseError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super('VALIDATION', message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(entityLabel: string, id: string) {
    super('NOT_FOUND', `${entityLabel} introuvable (${id}).`);
    this.name = 'NotFoundError';
  }
}

export class InsufficientStockError extends AppError {
  constructor(productName: string, available?: number, requested?: number) {
    super(
      'INSUFFICIENT_STOCK',
      available === undefined
        ? `Stock insuffisant pour « ${productName} ».`
        : `Stock insuffisant pour « ${productName} » : ${available} disponible(s)` +
            (requested === undefined ? '.' : `, ${requested} demandé(s).`),
    );
    this.name = 'InsufficientStockError';
  }
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return 'Une erreur inattendue est survenue.';
}
