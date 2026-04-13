import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Regional Integrated Transport",
  description: "Frontend prototype shell for the Lancashire regional transport application.",
};

const timeThemeScript = `
(() => {
  const getTimeTheme = () => new Date().getHours() >= 18 || new Date().getHours() < 6 ? "night" : "day";

  const applyTheme = () => {
    const pref = localStorage.getItem("theme-preference");
    const theme = pref === "light" ? "day" : pref === "dark" ? "night" : getTimeTheme();
    document.documentElement.dataset.theme = theme;
  };

  applyTheme();
  window.addEventListener("focus", applyTheme);
  document.addEventListener("visibilitychange", applyTheme);
  window.addEventListener("storage", applyTheme);
  window.setInterval(applyTheme, 60000);
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="day" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} antialiased`}
      >
        <Script id="time-theme" strategy="beforeInteractive">
          {timeThemeScript}
        </Script>
        {children}
      </body>
    </html>
  );
}
