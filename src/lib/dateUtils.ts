import { format, type FormatOptions } from "date-fns";

const ISO_LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/;
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

export function parseValidLocalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = ISO_LOCAL_DATE.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < MIN_YEAR || year > MAX_YEAR || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    !Number.isFinite(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) return null;

  return date;
}

export function isValidDate(value: Date | null | undefined): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

export function formatValidLocalDate(
  value: string | null | undefined,
  pattern: string,
  fallback = "—",
  options?: FormatOptions,
): string {
  const date = parseValidLocalDate(value);
  if (!date) return fallback;

  // Last-resort boundary: date-fns intentionally throws RangeError for an
  // invalid date. Imported/legacy records must never be able to crash React.
  try {
    return format(date, pattern, options);
  } catch (error) {
    console.warn("Data inválida ignorada durante formatação", { value, pattern, error });
    return fallback;
  }
}

export function toLocalDateKey(date: Date): string | null {
  if (!isValidDate(date)) return null;
  try {
    return format(date, "yyyy-MM-dd");
  } catch (error) {
    console.warn("Data inválida ignorada ao gerar chave local", { error });
    return null;
  }
}