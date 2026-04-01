import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AlephRob | Mars Rover Mission",
  description: "Autonomous geological sample validation using GenLayer AI consensus on Mars",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}