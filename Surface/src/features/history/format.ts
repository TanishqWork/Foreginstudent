import { statementTypes } from '../assessment/data'

export function statementTypeLabel(value: string | null): string {
  return statementTypes.find((type) => type.value === value)?.label ?? 'Statement'
}

export function contextLine(item: { degree: string | null; field: string | null; target_program?: string | null; target_institution?: string | null }): string {
  return [item.degree, item.field, item.target_program, item.target_institution].filter(Boolean).join(' · ') || 'Saved assessment'
}

export function formatDateTime(value: string, showTimeZone = false): string {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...(showTimeZone ? { second: '2-digit', timeZoneName: 'short' } : {}),
  }).format(new Date(value))
}

export function relativeTime(value: string): string {
  const delta = new Date(value).getTime() - Date.now()
  const abs = Math.abs(delta)
  const divisions: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 1000 * 60 * 60 * 24 * 365],
    ['month', 1000 * 60 * 60 * 24 * 30],
    ['day', 1000 * 60 * 60 * 24],
    ['hour', 1000 * 60 * 60],
    ['minute', 1000 * 60],
  ]
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  for (const [unit, ms] of divisions) {
    if (abs >= ms || unit === 'minute') return formatter.format(Math.round(delta / ms), unit)
  }
  return formatter.format(0, 'minute')
}
