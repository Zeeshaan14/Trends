"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAdminSession } from "@/hooks/use-admin-session"
import { LayoutDashboard, ShoppingCart, Shirt, LogOut, Loader2 } from "lucide-react"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isLoginPage = pathname === "/admin"

  // Only redirect on auth failure if we are NOT on the admin login page
  const { admin, loading, logout } = useAdminSession(!isLoginPage)

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Render the login page directly without the sidebar layout
  if (isLoginPage) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-border bg-card p-6 flex flex-col justify-between hidden md:flex">
        <div className="space-y-8">
          <Link href="/" className="inline-block">
            <div 
              className="h-10 w-[150px] bg-gradient-to-r from-primary to-foreground"
              style={{
                WebkitMaskImage: 'url(/nu3.png)',
                WebkitMaskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                WebkitMaskPosition: 'left center',
                maskImage: 'url(/nu3.png)',
                maskSize: 'contain',
                maskRepeat: 'no-repeat',
                maskPosition: 'left center',
              }}
            />
          </Link>
          
          <nav className="space-y-1">
            <Link
              href="/admin/dashboard"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                pathname === "/admin/dashboard"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
            
            <Link
              href="/admin/orders"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                pathname === "/admin/orders"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <ShoppingCart className="h-4 w-4" />
              Orders
            </Link>
            
            <Link
              href="/admin/jerseys"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                pathname === "/admin/jerseys"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Shirt className="h-4 w-4" />
              Jerseys
            </Link>
          </nav>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors w-full text-left"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between md:hidden">
          <Link href="/" className="inline-block">
            <div 
              className="h-8 w-[120px] bg-gradient-to-r from-primary to-foreground"
              style={{
                WebkitMaskImage: 'url(/nu3.png)',
                WebkitMaskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                WebkitMaskPosition: 'left center',
                maskImage: 'url(/nu3.png)',
                maskSize: 'contain',
                maskRepeat: 'no-repeat',
                maskPosition: 'left center',
              }}
            />
          </Link>
          
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-2">
              <Link href="/admin/dashboard" className={`p-2 rounded-lg ${pathname === "/admin/dashboard" ? "text-primary" : "text-muted-foreground"}`}>
                <LayoutDashboard className="h-5 w-5" />
              </Link>
              <Link href="/admin/orders" className={`p-2 rounded-lg ${pathname === "/admin/orders" ? "text-primary" : "text-muted-foreground"}`}>
                <ShoppingCart className="h-5 w-5" />
              </Link>
              <Link href="/admin/jerseys" className={`p-2 rounded-lg ${pathname === "/admin/jerseys" ? "text-primary" : "text-muted-foreground"}`}>
                <Shirt className="h-5 w-5" />
              </Link>
            </nav>
            <button onClick={logout} className="p-2 text-muted-foreground hover:text-destructive">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>
        
        <main className="flex-1 p-6 sm:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
