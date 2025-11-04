import { Suspense } from "react";

import BudgetShareExperience from "@/components/budget/BudgetShareExperience";
import { Spinner } from "@/components/ui/spinner";

type BudgetSharePageProps = {
  params: Promise<{ shareCode: string }>;
  searchParams?: Promise<{ month?: string }>;
};

export const metadata = {
  title: "Shared Budget Ledger",
  description:
    "View a read-only snapshot of this shared budget ledger for the selected month.",
};

const BudgetSharePage = async ({
  params,
  searchParams,
}: BudgetSharePageProps) => {
  const { shareCode } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialMonth =
    resolvedSearchParams?.month && typeof resolvedSearchParams.month === "string"
      ? resolvedSearchParams.month
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
        shareCode={shareCode}
        initialMonth={initialMonth}
      />
    </Suspense>
  );
};

export default BudgetSharePage;
