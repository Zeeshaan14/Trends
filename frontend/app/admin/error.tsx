"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Admin portal error:", error)
  }, [error])

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <h2 className="font-[var(--font-oswald)] text-3xl font-bold text-foreground mb-4">
        ADMIN PORTAL ERROR
      </h2>
      <p className="text-muted-foreground text-center max-w-md mb-8">
        An unexpected error occurred in the administrator dashboard. Please try again.
      </p>
      <div className="flex gap-4">
        <Button onClick={() => reset()}>Retry Session</Button>
        <Button variant="outline" onClick={() => window.location.href = "/admin/dashboard"}>
          Admin Dashboard
        </Button>
      </div>
    </div>
  )
}
