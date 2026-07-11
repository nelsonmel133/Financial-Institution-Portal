import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata = {
  title: "Tendai Reporting Platform | Multi-Tenant Financial Console",
  description:
    "Real-time multi-currency financial reporting, compliance command center, and retail cash flow analytics across tenant branches.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-paper font-sans text-ink antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
