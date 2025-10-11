import { useState } from "react"
import { Trash2, Edit2} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Expense, Member } from "@/types/group"
import { formatMoneySafe, formatMoneySafeGivenCurrency, formatMoneyWithMinor } from "@/lib/currency"
import { CurrencyCode, fromMinor, formatMoney } from "@/lib/currency_core"

export default function ExpenseListItem({
  expense,
  onEdit,
  onDelete,
  membersMapById,
  youId,
  group_currency
    
}: {
  expense: Expense
  onEdit: () => void
  onDelete: () => void
  membersMapById: Record<string, Member>
  youId: string
  group_currency: CurrencyCode
}) {

  const [expanded, setExpanded] = useState(false)
  console.log(expense)
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
    console.log("minor" + amountMinor)
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


  return (
    <div className="bg-white border-b py-3 px-4 hover:bg-slate-50 transition">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="text-center text-gray-400 w-10">
            <div className="text-xs uppercase">{date.toLocaleDateString('en-US', { month: 'short' })}</div>
            <div className="text-lg font-bold">{date.getDate()}</div>
          </div>
          <div className="text-gray-800 font-semibold underline cursor-pointer" onClick={() => setExpanded(!expanded)}>
            {expense.description}
          </div>
        </div>
        <div className="flex items-end gap-8 text-right">
  <div>
    <div className="text-xs text-gray-500">{payerLabel} paid</div>
    <div className="text-lg font-bold text-black">{formatMoneyWithMinor(amount, amountMinor, group_currency)}</div>
  </div>

  {yourSharePct > 0 && (
    <div>
      <div className="text-xs text-gray-500">{payerLabel} {lentVsOwed}</div>
      <div className="text-lg font-semibold text-orange-500">
      {owedTotal}
      </div>
    </div>
  )}
</div>


        <div className="flex gap-1 ml-4">
          <Button size="sm" variant="ghost" onClick={onEdit}><Edit2 className="w-4 h-4" /></Button>
          <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="w-4 h-4 text-red-600" /></Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-2 ml-12 text-xs text-gray-600 space-y-1">
          {Object.entries(expense.splits).map(([id, pct]) => {
            const name = membersMapById[id]?.firstName ?? id
            return <div key={id}>{name}: {pct.toFixed(2)}%</div>
          })}
        </div>
      )}
    </div>
  )
}
