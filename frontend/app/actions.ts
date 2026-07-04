"use server"

import { cookies } from "next/headers"

export async function setAuthCookies(accessToken: string, refreshToken: string) {
    const cookieStore = await cookies()
    
    // Set cookies on the frontend domain so Next.js middleware can read them
    cookieStore.set("admin_access_token", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60, // 1 hour
    })
    
    cookieStore.set("admin_refresh_token", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60, // 7 days
    })
}

export async function clearAuthCookies() {
    const cookieStore = await cookies()
    cookieStore.delete("admin_access_token")
    cookieStore.delete("admin_refresh_token")
}
