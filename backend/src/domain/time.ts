export const DAY_MS = 86_400_000;

export const daysBefore = (date: Date, days: number): Date => new Date(date.getTime() - days * DAY_MS);
