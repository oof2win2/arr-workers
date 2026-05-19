import React from "react";

export function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`badge ${className}`}>{children}</span>;
}
