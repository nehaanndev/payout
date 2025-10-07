// currency.ts (add this)
import { type CurrencyCode, FRACTION_DIGITS } from './currency_core'

export const DEFAULT_CURRENCY: CurrencyCode = 'USD';

export function getGroupCurrency(group: { currency?: string | null }): CurrencyCode {
  const c = (group?.currency || '').toUpperCase();
  return (c in FRACTION_DIGITS ? (c as CurrencyCode) : DEFAULT_CURRENCY);
}

// Optional: formatter that tolerates undefined currency
export function formatMoneySafe(
  minor: number,
  group: { currency?: string | null },
  locale = (typeof navigator !== 'undefined' ? navigator.language : 'en-US'),
) {
  const currency = getGroupCurrency(group);
  const d = FRACTION_DIGITS[currency];
  const major = minor / 10 ** d;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: d,
    minimumFractionDigits: d,
  }).format(major);
}

export function formatMoneySafeGivenCurrency(
    minor: number,
    currency: CurrencyCode,
    locale = (typeof navigator !== 'undefined' ? navigator.language : 'en-US'),
  ) {
    const d = FRACTION_DIGITS[currency];
    const major = minor / 10 ** d;
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: d,
      minimumFractionDigits: d,
    }).format(major);
  }