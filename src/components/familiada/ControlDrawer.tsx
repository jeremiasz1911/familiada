"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export function ControlDrawer({
  title,
  icon,
  defaultOpen,
  children,
}: {
  title: string;
  icon: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-2xl border border-white/10 bg-black/10 p-3" open={defaultOpen}>
      <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="opacity-80">{icon}</span>
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <ChevronDown className="opacity-70 transition group-open:rotate-180" size={18} />
      </summary>

      <div className="mt-3">{children}</div>
    </details>
  );
}