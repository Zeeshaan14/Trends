import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
    const token = request.cookies.get("admin_access_token")?.value
    const path = request.nextUrl.pathname

    const isLoginPage = path === "/admin"
    const isAdminArea = path.startsWith("/admin/")

    if (isAdminArea && !token) {
        return NextResponse.redirect(new URL("/admin", request.url))
    }

    if (isLoginPage && token) {
        return NextResponse.redirect(new URL("/admin/dashboard", request.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: ["/admin/:path*"],
}
