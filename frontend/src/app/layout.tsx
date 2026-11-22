import type { Metadata, Viewport } from 'next';
import { DM_Sans, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PulseHook — Discord Webhook Task Scheduler',
  description:
    'Full-stack Discord Webhook task scheduler with cron automation, configurable retries, execution log auditing, and live Discord embed preview.',
  icons: {
    icon: [{ url: '/icon.png', type: 'image/png' }, { url: '/favicon.ico' }],
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'PulseHook — Discord Webhook Task Scheduler',
    description:
      'Full-stack Discord Webhook task scheduler with cron automation, configurable retries, execution log auditing, and live Discord embed preview.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#F6F7FB',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-[#F6F7FB] text-[#111827] antialiased selection:bg-[#5865F2]/15 selection:text-[#111827]">
        {children}
      </body>
    </html>
  );
}
