"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Lock, Mail, LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { adminLogin } from "@/lib/api"

export default function AdminLoginPage() {
    const router = useRouter()
    const { toast } = useToast()
    const [isLoading, setIsLoading] = useState(false)
    const [formData, setFormData] = useState({
        email: "",
        password: "",
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

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

            // Store admin info in localStorage
            localStorage.setItem("adminUser", JSON.stringify(session))

            toast({
                title: "Login Successful",
                description: `Welcome back, ${session.user.companyName}!`,
            })

            if (session.user.role === "ADMIN") {
                router.push("/admin/jerseys")
            } else {
                router.push("/admin/dashboard")
            }
        } catch (error: any) {
            toast({
                title: "Login Failed",
                description: error.message || "Invalid credentials",
            })
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
                                type="password"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="pl-10 bg-background border-border"
                            />
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-12"
                    >
                        {isLoading ? (
                            "Signing in..."
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
