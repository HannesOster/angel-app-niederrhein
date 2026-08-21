import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Angel-App Niederrhein',
  description: 'Pegel, Wetter und Beißindex für die Gewässer um Kalkar, Rees und Kleve',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1f3b52',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="bg-background text-foreground antialiased">
        <div className="mx-auto min-h-dvh w-full max-w-md">{children}</div>
      </body>
    </html>
  )
}
