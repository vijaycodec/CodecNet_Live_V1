import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { ClientProvider } from '@/contexts/ClientContext'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SIEM Dashboard',
  description: 'Professional AI-powered SIEM Dashboard for comprehensive security monitoring and incident management',
  keywords: ['SIEM', 'Security', 'Monitoring', 'AI', 'Dashboard', 'Cybersecurity'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* PATCH 53: Google reCAPTCHA Enterprise Script (CWE-306 Fix) - Works for both UAT and Production */}
        <script src="https://www.google.com/recaptcha/enterprise.js?render=6LcgwAEsAAAAAOt45FtSbnP-NV_WThz1M_5nBMlM" async defer></script>
      </head>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ClientProvider>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 2000,
                style: {
                  background: 'var(--background)',
                  color: 'var(--foreground)',
                },
              }}
            />
          </ClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
} 