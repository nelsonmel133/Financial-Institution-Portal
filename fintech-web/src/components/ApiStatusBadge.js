"use client";
/**
 * src/components/ApiStatusBadge.js
 *
 * A small badge displayed when the backend is unreachable.
 * Import and render it inside SidebarNavigation or any layout component.
 */
import { useFinancial } from "@/context/FinancialContext";

export default function ApiStatusBadge() {
  const { apiOnline } = useFinancial();

  if (apiOnline) {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        API Live
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      Mock Data
    </div>
  );
}
