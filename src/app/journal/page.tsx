import { Suspense } from "react";

import JournalExperience from "@/components/journal/JournalExperience";
import { Spinner } from "@/components/ui/spinner";

export const metadata = {
  title: "Toodl Journal — Craft your daily story",
  description:
    "Capture meaningful reflections about work, family, growth, and everything in between with the colorful Toodl journal wizard.",
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
