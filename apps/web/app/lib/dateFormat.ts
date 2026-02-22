import { format } from 'date-fns';

export type DateFormatStyle = 'eu' | 'us';

export function getDateFormat(): DateFormatStyle {
  if (typeof window === 'undefined') return 'eu';
  return (localStorage.getItem('dateFormat') as DateFormatStyle) ?? 'eu';
}

export function formatDate(date: Date | string | null | undefined, includeTime = false): string {
  if (!date) return '-';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    const style = getDateFormat();
    const datePart = style === 'us' ? 'MM/dd/yyyy' : 'dd.MM.yyyy';
    return format(d, includeTime ? `${datePart} HH:mm` : datePart);
  } catch {
    return '-';
  }
}
