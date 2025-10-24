import { Suspense } from "react";

import BudgetExperience from "@/components/budget/BudgetExperience";
import { Spinner } from "@/components/ui/spinner";

export const metadata = {
  title: "Toodl Budget — Run the wizard & track your money",
  description:
    "Create a shared monthly budget, onboard your income and recurring bills, and track spending with the Toodl ledger.",
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
