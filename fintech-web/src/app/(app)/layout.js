"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Landmark } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { FinancialProvider } from "@/context/FinancialContext";
import SidebarNavigation from "@/components/SidebarNavigation";
import CurrencyConverterHeader from "@/components/CurrencyConverterHeader";

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-navy-950">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-vault-400/15 ring-1 ring-vault-400/30">
          <Landmark className="h-5 w-5 animate-pulse text-vault-400" strokeWidth={2.25} />
        </div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Verifying session…
        </p>
      </div>
    </div>
  );
}

/** Redirects to /login whenever there is no authenticated Firebase user. */
function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return <FullScreenLoader />;
  }

  return children;
}

export default function AppLayout({ children }) {
  return (
    <RequireAuth>
      <FinancialProvider>
        <div className="flex min-h-screen w-full">
          <SidebarNavigation />
          <div className="flex min-h-screen min-w-0 flex-1 flex-col">
            <CurrencyConverterHeader />
            <main className="flex-1 overflow-x-hidden bg-paper">{children}</main>
          </div>
        </div>
      </FinancialProvider>
    </RequireAuth>
  );
}
