import type React from "react"
import type { Metadata } from "next"
import { Inter, Oswald } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { SiteNavbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CartProvider } from "@/context/cart-context"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

const _inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const _oswald = Oswald({ subsets: ["latin"], variable: "--font-oswald" })

export const metadata: Metadata = {
  title: "NU Jerseys | Premium Jersey Designs",
  description: "Discover premium jersey designs for all sports. Cricket, Football, Basketball, Volleyball & more. Get unique, high-quality jersey designs for your team.",
  other: {
    "p:domain_verify": "1ec2721365fb067ddfc8a57150feb152",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preload" href="/nu3%20logo.png" as="image" type="image/png" />
      </head>
      <body suppressHydrationWarning className={`font-sans antialiased ${_inter.variable} ${_oswald.variable}`}>
        <CartProvider>
          <SiteNavbar />
          <main className="min-h-screen bg-background">
            {children}
          </main>
          <Footer />
          <Toaster />
        </CartProvider>
        <Analytics />
      </body>
    </html>
  )
}
