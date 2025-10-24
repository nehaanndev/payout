import BudgetExperience from "@/components/budget/BudgetExperience";

export const metadata = {
  title: "Toodl Budget — Run the wizard & track your money",
  description:
    "Create a shared monthly budget, onboard your income and recurring bills, and track spending with the Toodl ledger.",
};

const BudgetPage = () => {
  return <BudgetExperience />;
};

export default BudgetPage;
