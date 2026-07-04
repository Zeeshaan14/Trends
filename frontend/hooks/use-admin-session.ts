import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AdminUser } from "../lib/api"
import { getStoredAdminUser, clearStoredAdmin } from "../lib/auth/admin-session"

export function useAdminSession(redirectOnFail: boolean = true) {
    const router = useRouter()
    const [admin, setAdmin] = useState<AdminUser | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const user = getStoredAdminUser()
        if (!user) {
            setAdmin(null)
            setLoading(false)
            if (redirectOnFail) {
                router.push("/admin")
            }
            return
        }

        setAdmin(user)
        setLoading(false)
    }, [router, redirectOnFail])

    const logout = async () => {
        setLoading(true)
        try {
            // Call backend logout to delete the cookies
            const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"
            await fetch(`${API_BASE}/auth/admin/logout`, {
                method: "POST",
                credentials: "include",
            }).catch(() => {}) // Silently swallow fetch errors
        } finally {
            clearStoredAdmin()
            setAdmin(null)
            setLoading(false)
            router.push("/admin")
        }
    }

    return { admin, loading, logout, setAdmin }
}
