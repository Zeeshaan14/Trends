import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
    try {
        const { accessToken, refreshToken } = await request.json()

        if (!accessToken || !refreshToken) {
            return NextResponse.json({ error: "Missing tokens" }, { status: 400 })
        }

        const isProd = process.env.NODE_ENV === "production"
        const response = NextResponse.json({ success: true })

        response.cookies.set("admin_access_token", accessToken, {
            httpOnly: true,
            secure: isProd,
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60, // 1 hour
        })

        response.cookies.set("admin_refresh_token", refreshToken, {
            httpOnly: true,
            secure: isProd,
            sameSite: "lax",
            path: "/",
            maxAge: 7 * 24 * 60 * 60, // 7 days
        })

        return response
    } catch {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }
}
