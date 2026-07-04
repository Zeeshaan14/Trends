import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AdminUser } from "../lib/api"
import { getStoredAdminUser, getStoredAdminToken, clearStoredAdmin } from "../lib/auth/admin-session"
import { clearAuthCookies } from "@/app/actions"

export function useAdminSession(redirectOnFail: boolean = true) {
    const router = useRouter()
    const [admin, setAdmin] = useState<AdminUser | null>(null)
    const [token, setToken] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const user = getStoredAdminUser()
        const storedToken = getStoredAdminToken()
        if (!user || !storedToken) {
            setAdmin(null)
            setLoading(false)
            if (redirectOnFail) {
                router.push("/admin")
            }
            return
        }

        setAdmin(user)
        setToken(storedToken)
        setLoading(false)
    }, [router, redirectOnFail])

    const logout = async () => {
        setLoading(true)
        try {
            await clearAuthCookies()
            // Call backend logout to delete the cookies
            const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"
            await fetch(`${API_BASE}/auth/admin/logout`, {
                method: "POST",
                credentials: "include",
            }).catch(() => {}) // Silently swallow fetch errors
        } finally {
            clearStoredAdmin()
            setAdmin(null)
            setToken(null)
            setLoading(false)
            router.push("/admin")
        }
    }

    return { admin, token, loading, logout, setAdmin }
}
