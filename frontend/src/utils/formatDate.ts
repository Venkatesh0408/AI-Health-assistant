import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';

function parseDate(value: string | Date | undefined | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return isValid(value) ? value : null;
  }
  const iso = parseISO(value);
  if (isValid(iso)) return iso;
  const fallback = new Date(value);
  return isValid(fallback) ? fallback : null;
}

export function formatDate(value: string | Date | undefined | null): string {
  const parsed = parseDate(value);
  if (!parsed) return '—';
  return format(parsed, 'MMM d, yyyy');
}

export function formatShortDate(value: string | Date | undefined | null): string {
  const parsed = parseDate(value);
  if (!parsed) return '—';
  return format(parsed, 'MMM d');
}

export function formatDateTime(value: string | Date | undefined | null): string {
  const parsed = parseDate(value);
  if (!parsed) return '—';
  return format(parsed, 'MMM d, yyyy · h:mm a');
}

export function formatTime(value: string | Date | undefined | null): string {
  const parsed = parseDate(value);
  if (!parsed) return '';
  return format(parsed, 'h:mm a');
}

export function formatRelativeTime(value: string | Date | undefined | null): string {
  const parsed = parseDate(value);
  if (!parsed) return '—';
  return formatDistanceToNow(parsed, { addSuffix: true });
}
