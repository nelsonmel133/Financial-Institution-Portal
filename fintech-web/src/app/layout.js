import "./globals.css";
import { FinancialProvider } from "@/context/FinancialContext";
import SidebarNavigation from "@/components/SidebarNavigation";
import CurrencyConverterHeader from "@/components/CurrencyConverterHeader";

export const metadata = {
  title: "Tendai Reporting Platform | Multi-Tenant Financial Console",
  description:
    "Real-time multi-currency financial reporting, compliance command center, and retail cash flow analytics across tenant branches.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-paper font-sans text-ink antialiased">
        <FinancialProvider>
          <div className="flex min-h-screen w-full">
            <SidebarNavigation />
            <div className="flex min-h-screen min-w-0 flex-1 flex-col">
              <CurrencyConverterHeader />
              <main className="flex-1 overflow-x-hidden bg-paper">{children}</main>
            </div>
          </div>
        </FinancialProvider>
      </body>
    </html>
  );
}
