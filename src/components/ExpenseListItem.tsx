import { useState } from "react"
import { Trash2, Edit2, ChevronDown, ChevronUp, ReceiptText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Expense, Member } from "@/types/group"

export default function ExpenseListItem({
  expense,
  onEdit,
  onDelete,
  membersMapById,
  youId
}: {
  expense: Expense
  onEdit: () => void
  onDelete: () => void
  membersMapById: Record<string, Member>
  youId: string
}) {
  const [expanded, setExpanded] = useState(false)
  const payer = membersMapById[expense.paidBy]?.firstName ?? expense.paidBy
  const date = new Date(expense.createdAt)
  const userShare = expense.splits[youId] ?? 0
  const lentAmount = (expense.amount * userShare) / 100

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
        <div className="text-right text-sm">
          <div className="text-gray-500">{payer} paid</div>
          <div className="font-bold text-black">${expense.amount.toFixed(2)}</div>
          {userShare > 0 && (
            <>
              <div className="text-gray-500">{payer} lent you</div>
              <div className="text-orange-500 font-semibold">${lentAmount.toFixed(2)}</div>
            </>
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
