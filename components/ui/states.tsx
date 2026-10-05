import type { ReactNode } from "react";
import { m } from "framer-motion";
import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import { dur, ease } from "@/lib/motion";

function Frame({
  icon,
  title,
  message,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  message: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <m.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: dur.base, ease: ease.out }}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border px-6 py-12 text-center",
        className,
      )}
    >
      <div className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
      {action}
    </m.div>
  );
}

export function EmptyState({
  title,
  message,
  action,
  icon,
  className,
}: {
  title: string;
  message: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <Frame
      icon={icon ?? <Inbox className="size-5" />}
      title={title}
      message={message}
      action={action}
      className={className}
    />
  );
}

export function ErrorState({
  message = "Something went wrong while loading this.",
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <Frame
      icon={<AlertCircle className="size-5 text-danger" />}
      title="Could not load"
      message={message}
      action={
        onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="size-3.5" /> Retry
          </Button>
        ) : undefined
      }
      className={className}
    />
  );
}
