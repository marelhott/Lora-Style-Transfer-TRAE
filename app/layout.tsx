import "./globals.css"

import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { ConvexClientProvider } from "@/components/convex-client-provider"
import { Toaster } from "@/components/ui/toaster"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "AI Style Transfer",
  description: "Transform your images with AI-powered style transfer using advanced neural networks, LoRA models, and customizable parameters for stunning artistic results.",
}

export const dynamic = 'force-dynamic'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <ConvexClientProvider>
            {children}
            <Toaster />
          </ConvexClientProvider>
        </body>
    </html>
  )
}