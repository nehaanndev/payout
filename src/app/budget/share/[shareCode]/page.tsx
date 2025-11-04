import { Suspense } from "react";

import BudgetShareExperience from "@/components/budget/BudgetShareExperience";
import { Spinner } from "@/components/ui/spinner";

type BudgetSharePageProps = {
  params: { shareCode: string };
  searchParams?: { month?: string };
};

export const metadata = {
  title: "Shared Budget Ledger",
  description:
    "View a read-only snapshot of this shared budget ledger for the selected month.",
};

const BudgetSharePage = ({ params, searchParams }: BudgetSharePageProps) => {
  const initialMonth =
    searchParams?.month && typeof searchParams.month === "string"
      ? searchParams.month
      : undefined;

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <Spinner size="lg" />
        </div>
      }
    >
      <BudgetShareExperience
        shareCode={params.shareCode}
        initialMonth={initialMonth}
      />
    </Suspense>
  );
};

export default BudgetSharePage;
