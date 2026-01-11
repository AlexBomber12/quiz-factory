import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Quiz Factory",
  description: "Factory-floor tooling for quiz creation"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
