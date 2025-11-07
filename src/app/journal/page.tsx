import { Suspense } from "react";

import JournalExperience from "@/components/journal/JournalExperience";
import { Spinner } from "@/components/ui/spinner";

export const metadata = {
  title: "Toodl Story — Journal beside your ledger",
  description:
    "Capture meaningful reflections about work, family, growth, and everything in between, then link them to budgets, flows, and splits.",
};

const JournalPage = () => (
  <Suspense
    fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    }
  >
    <JournalExperience />
  </Suspense>
);

export default JournalPage;
