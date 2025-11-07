import { Suspense } from "react";

import BudgetExperience from "@/components/budget/BudgetExperience";
import { Spinner } from "@/components/ui/spinner";

export const metadata = {
  title: "Toodl Pulse — Keep budgets breathing",
  description:
    "Create a shared monthly budget, onboard your income and recurring bills, and let AI keep projections up to date.",
};

const BudgetPage = () => (
  <Suspense
    fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    }
  >
    <BudgetExperience />
  </Suspense>
);

export default BudgetPage;
