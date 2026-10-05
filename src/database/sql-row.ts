import { DatabaseError } from '@/core/errors/app-error';
import { SqlRow } from './sql.types';

function invalidColumn(column: string, expected: string): DatabaseError {
  return new DatabaseError(`Colonne « ${column} » invalide : ${expected} attendu.`);
}

export function readString(row: SqlRow, column: string): string {
  const value = row[column];
  if (typeof value !== 'string') {
    throw invalidColumn(column, 'texte');
  }
  return value;
}

export function readNullableString(row: SqlRow, column: string): string | null {
  const value = row[column];
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    throw invalidColumn(column, 'texte ou NULL');
  }
  return value;
}

export function readNumber(row: SqlRow, column: string): number {
  const value = row[column];
  if (typeof value !== 'number') {
    throw invalidColumn(column, 'nombre');
  }
  return value;
}

export function readNullableNumber(row: SqlRow, column: string): number | null {
  const value = row[column];
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'number') {
    throw invalidColumn(column, 'nombre ou NULL');
  }
  return value;
}

export function readEnum<T extends string>(row: SqlRow, column: string, allowed: readonly T[]): T {
  const value = readString(row, column);
  const match = allowed.find((candidate) => candidate === value);
  if (match === undefined) {
    throw invalidColumn(column, allowed.join(' | '));
  }
  return match;
}
