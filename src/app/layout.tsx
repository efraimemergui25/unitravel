import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { I18nProvider } from '@/providers/I18nProvider';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Unitravel — AI Travel Operating System',
  description: 'Zero-click anticipatory travel planning. Built for the global traveler.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={inter.variable}>
      <body className="antialiased overflow-hidden bg-[#080B14] text-white">
        <I18nProvider>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
