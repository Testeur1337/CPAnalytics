import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "CPA Tracker Hub",
  description: "Campaign tracking dashboard"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <nav style={{ marginBottom: "1rem" }}>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/create">Create Link</Link>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
