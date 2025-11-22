import { useState } from "react"
import { Trash2, Edit2, Calendar, TrendingUp, TrendingDown, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Expense, Member } from "@/types/group"
import { formatMoneyWithMinor } from "@/lib/currency"
import { CurrencyCode, formatMoney } from "@/lib/currency_core"
import { cn } from "@/lib/utils"

export default function ExpenseListItem({
  expense,
  onEdit,
  onDelete,
  membersMapById,
  youId,
  group_currency,
  isNight = false
}: {
  expense: Expense
  onEdit: () => void
  onDelete: () => void
  membersMapById: Record<string, Member>
  youId: string
  group_currency: CurrencyCode
  isNight?: boolean
}) {

  const [expanded, setExpanded] = useState(false)
  const payerName = membersMapById[expense.paidBy]?.firstName ?? expense.paidBy
  const date = new Date(expense.createdAt)

  const yourSharePct = expense.splits[youId] ?? 0
  const amount = expense.amount
  const amountMinor = expense.amountMinor ?? 0

  const isPayerYou = expense.paidBy === youId

  // --- Helper for currency-safe rounding (2 decimals)
  const round2 = (n: number) => Math.round(n * 100) / 100

  // When YOU paid, how much you’re owed in total = sum of others’ shares
  let youAreOwedTotal = 0
  const owedByMember: Record<string, number> = {}

  if (isPayerYou) {
    if (amountMinor > 0){
      for (const [memberId, splitMinor] of Object.entries(expense.splitsMinor)) {
        if (memberId == youId) continue
        owedByMember[memberId] = splitMinor
        youAreOwedTotal += splitMinor
      }
    } else {
      for (const [memberId, pct] of Object.entries(expense.splits)) {
        if (memberId === youId) continue // skip your own share
        const owed = round2((amount * pct) / 100)
        owedByMember[memberId] = owed
        youAreOwedTotal += owed
      }
      youAreOwedTotal = round2(youAreOwedTotal)
    }
  }

  // You can use payerLabel in the UI
  const payerLabel = isPayerYou ? "You" : payerName
  const owedTotal = !isPayerYou ? 
    (amountMinor > 0 ? formatMoney(expense.splitsMinor[youId], group_currency) : round2((amount * yourSharePct) / 100)) : 
    (amountMinor > 0 ? formatMoney(youAreOwedTotal, group_currency) : youAreOwedTotal)
  const lentVsOwed = isPayerYou ? "get back" : "lent you"


  // Determine accent color based on payer
  const accentColor = isPayerYou 
    ? isNight ? "border-l-emerald-400/50" : "border-l-emerald-500"
    : isNight ? "border-l-indigo-400/50" : "border-l-indigo-500"

  return (
    <div className={cn(
      "group relative rounded-2xl border-l-4 border-r border-t border-b transition-all duration-200",
      isNight 
        ? "bg-slate-800/60 border-white/10 hover:bg-slate-800/80 hover:shadow-lg hover:shadow-slate-900/50 shadow-sm" 
        : "bg-white border-slate-300 shadow-md hover:bg-slate-50 hover:shadow-lg hover:shadow-slate-400/30",
      accentColor
    )}>
      <div className="p-4">
        <div className="flex justify-between items-start gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Date Badge - Improved styling */}
            <div className={cn(
              "flex-shrink-0 rounded-xl border text-center p-2 min-w-[3.5rem]",
              isNight 
                ? "border-white/20 bg-white/5" 
                : "border-slate-200 bg-slate-50"
            )}>
              <div className={cn("text-[10px] uppercase font-semibold tracking-wider", isNight ? "text-slate-400" : "text-slate-500")}>
                {date.toLocaleDateString('en-US', { month: 'short' })}
              </div>
              <div className={cn("text-xl font-bold leading-none mt-1", isNight ? "text-white" : "text-slate-900")}>
                {date.getDate()}
              </div>
            </div>
            
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-start gap-2">
                <DollarSign className={cn("h-4 w-4 flex-shrink-0 mt-0.5", isNight ? "text-slate-400" : "text-slate-500")} />
                <h3 
                  className={cn(
                    "font-semibold cursor-pointer hover:underline transition",
                    isNight ? "text-white" : "text-slate-900"
                  )} 
                  onClick={() => setExpanded(!expanded)}
                >
                  {expense.description}
                </h3>
              </div>
              
              {/* Amounts with better typography */}
              <div className="flex flex-wrap items-baseline gap-4">
                <div>
                  <div className={cn("text-[10px] uppercase tracking-wider font-medium mb-0.5", isNight ? "text-slate-400" : "text-slate-500")}>
                    {payerLabel} paid
                  </div>
                  <div className={cn("text-xl font-bold", isNight ? "text-white" : "text-slate-900")}>
                    {formatMoneyWithMinor(amount, amountMinor, group_currency)}
                  </div>
                </div>

                {yourSharePct > 0 && (
                  <div>
                    <div className={cn("text-[10px] uppercase tracking-wider font-medium mb-0.5 flex items-center gap-1", isNight ? "text-slate-400" : "text-slate-500")}>
                      {isPayerYou ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {payerLabel} {lentVsOwed}
                    </div>
                    <div className={cn("text-xl font-bold", isNight ? "text-amber-300" : "text-orange-600")}>
                      {owedTotal}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-1 flex-shrink-0">
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={onEdit} 
              className={cn(
                "transition-all",
                isNight 
                  ? "text-slate-300 hover:text-white hover:bg-white/10" 
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={onDelete} 
              className={cn(
                "transition-all",
                isNight 
                  ? "text-rose-300 hover:text-rose-200 hover:bg-rose-500/20" 
                  : "text-red-600 hover:text-red-700 hover:bg-red-50"
              )}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Expanded splits view */}
        {expanded && (
          <div className={cn(
            "mt-4 pt-4 border-t space-y-2",
            isNight ? "border-white/10" : "border-slate-200"
          )}>
            <p className={cn("text-xs font-semibold uppercase tracking-wider mb-2", isNight ? "text-slate-400" : "text-slate-500")}>
              Split breakdown
            </p>
            <div className={cn("grid grid-cols-2 gap-2 text-xs", isNight ? "text-slate-300" : "text-slate-600")}>
              {Object.entries(expense.splits).map(([id, pct]) => {
                const name = membersMapById[id]?.firstName ?? id
                const isYou = id === youId
                return (
                  <div 
                    key={id} 
                    className={cn(
                      "flex items-center justify-between px-2 py-1 rounded",
                      isNight 
                        ? isYou ? "bg-white/5" : ""
                        : isYou ? "bg-slate-100" : ""
                    )}
                  >
                    <span className={cn("font-medium", isYou && isNight ? "text-white" : "")}>{isYou ? "You" : name}</span>
                    <span className={cn("font-semibold", isNight ? "text-slate-200" : "text-slate-700")}>{pct.toFixed(1)}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
