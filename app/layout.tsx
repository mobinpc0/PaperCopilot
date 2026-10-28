import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "PAPER COPILOT // Autonomous Research Lab",
  description: "AI-powered scientific paper analysis, multi-corpus comparison, and literature synthesis.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              try {
                var saved = localStorage.getItem('paper_copilot_theme');
                var theme = saved ? saved : 'dark';
                document.documentElement.setAttribute('data-theme', theme);
              } catch(e) {}
            })();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
