"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function CheckoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Checkout route error:", error)
  }, [error])

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <h2 className="font-[var(--font-oswald)] text-3xl font-bold text-foreground mb-4">
        SOMETHING WENT WRONG
      </h2>
      <p className="text-muted-foreground text-center max-w-md mb-8">
        We encountered an error loading the checkout page. Please try refreshing or re-adding the items to your cart.
      </p>
      <div className="flex gap-4">
        <Button onClick={() => reset()}>Try Again</Button>
        <Button variant="outline" onClick={() => window.location.href = "/"}>
          Return Home
        </Button>
      </div>
    </div>
  )
}
