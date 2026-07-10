"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Lock, Mail, LogIn, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { adminLogin } from "@/lib/api"
import { setStoredAdminUser, setStoredAdminToken } from "@/lib/auth/admin-session"


export default function AdminLoginPage() {
    const router = useRouter()
    const { toast } = useToast()
    const [isLoading, setIsLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [formData, setFormData] = useState({
        email: "",
        password: "",
    })
    
    // Front-end brute force protection (Exponential backoff)
    const [failedAttempts, setFailedAttempts] = useState(0)
    const [cooldownTime, setCooldownTime] = useState(0)

    useEffect(() => {
        if (cooldownTime <= 0) return
        const timer = setInterval(() => {
            setCooldownTime((prev) => prev - 1)
        }, 1000)
        return () => clearInterval(timer)
    }, [cooldownTime])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (cooldownTime > 0) {
            toast({
                title: "Too Many Requests",
                description: `Please wait ${cooldownTime} seconds before trying again.`,
                variant: "destructive"
            })
            return
        }

        if (!formData.email || !formData.password) {
            toast({
                title: "Missing Fields",
                description: "Please enter both email and password.",
            })
            return
        }

        setIsLoading(true)

        try {
            const session = await adminLogin(formData.email, formData.password)

            // Set httpOnly cookies via Next.js API route (more reliable than Server Actions from client components)
            const cookieRes = await fetch("/api/set-admin-cookies", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ accessToken: session.accessToken, refreshToken: session.refreshToken }),
            })
            if (!cookieRes.ok) throw new Error("Failed to set session cookies")

            // Store ONLY non-sensitive user profile in local storage
            setStoredAdminUser(session.user)
            setStoredAdminToken(session.accessToken)
            setFailedAttempts(0)

            toast({
                title: "Login Successful",
                description: `Welcome back, ${session.user.companyName}!`,
            })

            // Refresh the router first so Next.js re-syncs the cookie state
            // before the middleware checks it on the dashboard navigation.
            router.refresh()
            if (session.user.role === "ADMIN") {
                router.push("/admin/jerseys")
            } else {
                router.push("/admin/dashboard")
            }
        } catch (error: any) {
            const nextAttempts = failedAttempts + 1
            setFailedAttempts(nextAttempts)
            
            // Set cooldown after 3 failed attempts: 30s, 60s, 120s...
            if (nextAttempts >= 3) {
                const backoff = 30 * Math.pow(2, nextAttempts - 3)
                setCooldownTime(backoff)
                toast({
                    title: "Too Many Failed Attempts",
                    description: `Too many failed logins. System is locked for ${backoff} seconds.`,
                    variant: "destructive"
                })
            } else {
                toast({
                    title: "Login Failed",
                    description: error.message || "Invalid credentials",
                    variant: "destructive"
                })
            }
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
                        <Lock className="h-8 w-8 text-primary" />
                    </div>
                    <h1 className="font-[var(--font-oswald)] text-4xl font-bold text-foreground">
                        ADMIN LOGIN
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Sign in to access the admin dashboard
                    </p>
                </div>

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="bg-secondary/30 rounded-xl p-8 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            Email
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="email"
                                placeholder="admin@example.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="pl-10 bg-background border-border"
                                disabled={cooldownTime > 0}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="pl-10 pr-10 bg-background border-border"
                                disabled={cooldownTime > 0}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                disabled={cooldownTime > 0}
                            >
                                {showPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={isLoading || cooldownTime > 0}
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-12"
                    >
                        {isLoading ? (
                            "Signing in..."
                        ) : cooldownTime > 0 ? (
                            `Locked (${cooldownTime}s)`
                        ) : (
                            <>
                                <LogIn className="h-4 w-4 mr-2" />
                                Sign In
                            </>
                        )}
                    </Button>
                </form>

                <p className="text-center text-xs text-muted-foreground mt-6">
                    This area is restricted to authorized administrators only.
                </p>
            </div>
        </div>
    )
}
