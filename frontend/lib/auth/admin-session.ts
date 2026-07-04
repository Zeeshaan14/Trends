import { AdminUser } from "../api"

const ADMIN_USER_KEY = "nujerseys-admin-profile"

export function getStoredAdminUser(): AdminUser | null {
    if (typeof window === "undefined") return null
    try {
        const stored = localStorage.getItem(ADMIN_USER_KEY)
        return stored ? JSON.parse(stored) : null
    } catch {
        return null
    }
}

export function setStoredAdminUser(user: AdminUser): void {
    if (typeof window === "undefined") return
    try {
        localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user))
    } catch {
        // Silently fail
    }
}

export function clearStoredAdmin(): void {
    if (typeof window === "undefined") return
    try {
        localStorage.removeItem(ADMIN_USER_KEY)
        // Also clean up any legacy adminUser keys
        localStorage.removeItem("adminUser")
    } catch {
        // Silently fail
    }
}
