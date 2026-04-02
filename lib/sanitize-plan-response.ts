import type { SchedulePlan } from "@/lib/types";

export function sanitizePlanForClient(plan: SchedulePlan) {
  const { generation: _generation, ...rest } = plan;

  return {
    ...rest,
    workflow: {
      ...plan.workflow,
      steps: plan.workflow.steps.map(({ execution: _execution, ...step }) => step),
    },
  };
}

export type ClientSchedulePlan = ReturnType<typeof sanitizePlanForClient>;
