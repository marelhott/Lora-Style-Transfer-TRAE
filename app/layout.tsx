import "./globals.css"

import type { Metadata } from "next"
import { Inter } from "next/font/google"

const inter = Inter({
  variable: "--font-inter",
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
          className={`${inter.variable} antialiased`}
        >
          {children}
        </body>
    </html>
  )
}