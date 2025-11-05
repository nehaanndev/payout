import { Suspense } from "react";

import { FlowExperience } from "@/components/flow/FlowExperience";
import { Spinner } from "@/components/ui/spinner";

const FlowPage = () => (
  <Suspense
    fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner />
      </div>
    }
  >
    <FlowExperience />
  </Suspense>
);

export default FlowPage;
