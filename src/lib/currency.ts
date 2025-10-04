// currency.ts

// Top 20 coverage currencies
export type CurrencyCode =
  | 'INR' | 'CNY' | 'USD' | 'EUR' | 'IDR'
  | 'PKR' | 'NGN' | 'BRL' | 'BDT' | 'RUB'
  | 'MXN' | 'JPY' | 'ETB' | 'PHP' | 'EGP'
  | 'VND' | 'CDF' | 'IRR' | 'TRY' | 'THB';

// Label + symbol for select menus (display only)
export const SUPPORTED_CURRENCIES: ReadonlyArray<{
  code: CurrencyCode;
  label: string;
  symbol: string;
}> = [
  { code: 'INR', label: 'Indian Rupee',        symbol: '₹'  },
  { code: 'CNY', label: 'Chinese Yuan',        symbol: '¥'  },
  { code: 'USD', label: 'US Dollar',           symbol: '$'  },
  { code: 'EUR', label: 'Euro',                symbol: '€'  },
  { code: 'IDR', label: 'Indonesian Rupiah',   symbol: 'Rp' },
  { code: 'PKR', label: 'Pakistani Rupee',     symbol: '₨'  },
  { code: 'NGN', label: 'Nigerian Naira',      symbol: '₦'  },
  { code: 'BRL', label: 'Brazilian Real',      symbol: 'R$' },
  { code: 'BDT', label: 'Bangladeshi Taka',    symbol: '৳'  },
  { code: 'RUB', label: 'Russian Ruble',       symbol: '₽'  },
  { code: 'MXN', label: 'Mexican Peso',        symbol: '$'  }, // display code too to avoid "$" confusion
  { code: 'JPY', label: 'Japanese Yen',        symbol: '¥'  },
  { code: 'ETB', label: 'Ethiopian Birr',      symbol: 'Br' },
  { code: 'PHP', label: 'Philippine Peso',     symbol: '₱'  },
  { code: 'EGP', label: 'Egyptian Pound',      symbol: 'E£' },
  { code: 'VND', label: 'Vietnamese Dong',     symbol: '₫'  },
  { code: 'CDF', label: 'Congolese Franc',     symbol: 'FC' },
  { code: 'IRR', label: 'Iranian Rial',        symbol: '﷼'  },
  { code: 'TRY', label: 'Turkish Lira',        symbol: '₺'  },
  { code: 'THB', label: 'Thai Baht',           symbol: '฿'  },
] as const;

// Minor units (fraction digits) for storage in "minor" integer units.
// Note: some currencies (e.g., JPY, VND, IDR) have 0 fractional units.
export const FRACTION_DIGITS: Record<CurrencyCode, number> = {
  INR: 2, CNY: 2, USD: 2, EUR: 2,
  IDR: 0, // rupiah
  PKR: 2, NGN: 2, BRL: 2, BDT: 2, RUB: 2,
  MXN: 2,
  JPY: 0, // yen
  ETB: 2, PHP: 2, EGP: 2,
  VND: 0, // dong
  CDF: 2,
  IRR: 2,
  TRY: 2, THB: 2,
};

// Helpers to convert between major (human input) and minor (storage)
export function toMinor(amountMajor: number, currency: CurrencyCode): number {
  const d = FRACTION_DIGITS[currency];
  return Math.round(amountMajor * 10 ** d);
}

export function fromMinor(amountMinor: number, currency: CurrencyCode): number {
  const d = FRACTION_DIGITS[currency];
  return amountMinor / 10 ** d;
}

// Locale-aware formatter for views
export function formatMoney(minor: number, currency: CurrencyCode, locale = navigator.language) {
  const major = fromMinor(minor, currency);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    // Let Intl handle typical formatting, but clamp to the currency’s minor units
    maximumFractionDigits: FRACTION_DIGITS[currency],
    minimumFractionDigits: FRACTION_DIGITS[currency],
    currencyDisplay: 'symbol',
  }).format(major);
}
