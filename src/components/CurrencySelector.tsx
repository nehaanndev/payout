"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyCode, SUPPORTED_CURRENCIES } from "@/lib/currency_core";
import { cn } from "@/lib/utils";
import { Search, Check } from "lucide-react";

interface CurrencySelectorProps {
  value: CurrencyCode | "";
  onChange: (value: CurrencyCode) => void;
  label?: string;
  className?: string;
  isNight?: boolean;
}

export default function CurrencySelector({
  value,
  onChange,
  label = "Currency",
  className,
  isNight = false,
}: CurrencySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCurrencies = useMemo(() => {
    if (!searchQuery.trim()) return SUPPORTED_CURRENCIES;
    const query = searchQuery.toLowerCase();
    return SUPPORTED_CURRENCIES.filter(
      (c) =>
        c.code.toLowerCase().includes(query) ||
        c.label.toLowerCase().includes(query) ||
        c.symbol.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const selectedCurrency = SUPPORTED_CURRENCIES.find((c) => c.code === value);

  return (
    <div className={cn("space-y-1", className)}>
      <Label className={cn("text-sm font-medium", isNight ? "text-slate-200" : "text-slate-700")}>
        {label}
      </Label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-full mt-1 rounded-xl border p-2 text-sm text-left flex items-center justify-between",
            isNight
              ? "border-white/30 bg-slate-900/50 text-white focus:border-white/50 focus:outline-none focus:ring-2 focus:ring-white/20"
              : "border-slate-300 bg-white focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
          )}
        >
          <span>
            {selectedCurrency
              ? `${selectedCurrency.symbol} ${selectedCurrency.label} (${selectedCurrency.code})`
              : "Select currency"}
          </span>
          <Search className={cn("h-4 w-4", isNight ? "text-slate-400" : "text-slate-500")} />
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <div
              className={cn(
                "absolute z-50 w-full mt-1 rounded-xl border shadow-lg max-h-64 overflow-hidden",
                isNight
                  ? "border-white/30 bg-slate-900/95"
                  : "border-slate-300 bg-white"
              )}
            >
              <div className="p-2 border-b" style={isNight ? { borderColor: 'rgba(255, 255, 255, 0.1)' } : { borderColor: 'rgb(226, 232, 240)' }}>
                <div className="relative">
                  <Search
                    className={cn(
                      "absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4",
                      isNight ? "text-slate-400" : "text-slate-500"
                    )}
                  />
                  <Input
                    type="text"
                    placeholder="Search currencies..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={cn(
                      "pl-8",
                      isNight
                        ? "border-white/30 bg-slate-800/50 text-white placeholder:text-white/40"
                        : ""
                    )}
                    autoFocus
                  />
                </div>
              </div>
              <div className="overflow-y-auto max-h-48">
                {filteredCurrencies.length === 0 ? (
                  <div className={cn("p-3 text-sm text-center", isNight ? "text-slate-400" : "text-slate-500")}>
                    No currencies found
                  </div>
                ) : (
                  filteredCurrencies.map((currency) => (
                    <button
                      key={currency.code}
                      type="button"
                      onClick={() => {
                        onChange(currency.code);
                        setIsOpen(false);
                        setSearchQuery("");
                      }}
                      className={cn(
                        "w-full px-3 py-2 text-sm text-left flex items-center justify-between hover:bg-slate-100 transition-colors",
                        value === currency.code && "bg-slate-100",
                        isNight && "hover:bg-white/10 text-white",
                        isNight && value === currency.code && "bg-white/10"
                      )}
                    >
                      <span>
                        {currency.symbol} {currency.label} ({currency.code})
                      </span>
                      {value === currency.code && (
                        <Check className={cn("h-4 w-4", isNight ? "text-emerald-400" : "text-emerald-600")} />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
      {value === "MXN" && (
        <p className="text-xs text-slate-500 mt-1">
          Heads-up: both USD and MXN use &quot;$&quot;. We&apos;ll display the code alongside the symbol where space is tight.
        </p>
      )}
    </div>
  );
}


