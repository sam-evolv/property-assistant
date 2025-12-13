import type { Metadata } from "next";
import { ReactNode } from "react";

/**
 * Root layout for the Unified Portal (resident + developer app)
 * This replaces the old App.tsx responsibility in App Router.
 */

export const metadata: Metadata = {
  title: "OpenHouseAi",
  description: "The AI resident portal for modern developments",
};

export default function UnifiedPortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className="
          min-h-[100dvh]
          bg-[#0A0A0A]
          text-white
          antialiased
          overflow-x-hidden
        "
      >
        {/* 
          App Shell Root
          Do NOT put fixed navbars or chat inputs here yet.
          This file must stay structurally clean.
        */}
        <div
          id="app-root"
          className="
            relative
            min-h-[100dvh]
            w-full
            flex
            flex-col
          "
        >
          {children}
        </div>
      </body>
    </html>
  );
}
