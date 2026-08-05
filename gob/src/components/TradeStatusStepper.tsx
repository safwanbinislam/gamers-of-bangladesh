"use client";

import { getStatusColor, getStatusLabel } from "@/lib/utils";

interface TradeStatusStepperProps { currentStatus: string; }

const STEPS = [
  { key: "awaiting_payment", label: "Awaiting Payment" },
  { key: "funds_held", label: "Funds Held" },
  { key: "item_delivered", label: "Item Delivered" },
  { key: "released", label: "Completed" },
];

const TERMINAL_STATUSES = ["disputed", "refunded", "cancelled", "auto_released"];

export function TradeStatusStepper({ currentStatus }: TradeStatusStepperProps) {
  if (TERMINAL_STATUSES.includes(currentStatus)) {
    const color = getStatusColor(currentStatus);
    return (
      <div className="bg-dark-surface border border-dark-border rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${color.dot}`} />
          <div>
            <p className={`font-semibold ${color.text}`}>{getStatusLabel(currentStatus)}</p>
            <p className="text-sm text-text-muted">
              {currentStatus === "disputed" && "A dispute has been opened for this trade."}
              {currentStatus === "refunded" && "The buyer has been refunded."}
              {currentStatus === "cancelled" && "This trade was cancelled."}
              {currentStatus === "auto_released" && "Funds were auto-released after 48 hours."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currentStepIndex = STEPS.findIndex((s) => s.key === currentStatus);

  return (
    <div className="bg-dark-surface border border-dark-border rounded-xl p-4">
      <div className="flex flex-col sm:flex-row gap-0">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          return (
            <div key={step.key} className="flex-1 relative">
              {index < STEPS.length - 1 && (
                <div className={`hidden sm:block absolute top-4 left-[calc(50%+16px)] right-[calc(50%-16px)] h-0.5 ${isCompleted ? "bg-success" : "bg-dark-border"}`} />
              )}
              <div className="flex sm:flex-col items-center gap-2 sm:gap-1.5">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  isCompleted ? "bg-success text-white" : isCurrent ? "ring-2 ring-primary bg-dark-surface-2 text-primary-light" : "bg-dark-surface-2 text-text-muted"
                }`}>{isCompleted ? "✓" : index + 1}</div>
                <span className={`text-xs text-center leading-tight ${isCurrent ? "text-primary font-semibold" : isCompleted ? "text-success" : "text-text-muted"}`}>
                  {step.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}