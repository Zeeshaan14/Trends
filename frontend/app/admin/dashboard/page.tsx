"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
    LayoutDashboard,
    ShoppingCart,
    Shirt,
    Users,
    DollarSign,
    TrendingUp,
    Package,
    LogOut,
    ChevronRight
} from "lucide-react"
import { getDashboardStats, DashboardStats } from "@/lib/api"
import { useAdminSession } from "@/hooks/use-admin-session"
import { Button } from "@/components/ui/button"

export default function AdminDashboardPage() {
    const { admin, token, logout } = useAdminSession(true)
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!admin || !token) return

        // Fetch dashboard stats
        getDashboardStats(token)
            .then(setStats)
            .catch((err) => {
                console.error("Failed to fetch stats:", err)
                if (err.status === 401 || err.status === 403) {
                    logout()
                }
            })
            .finally(() => setLoading(false))
    }, [admin, logout])

    const handleLogout = () => {
        logout()
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-background pt-24 pb-12 px-4">
                <div className="max-w-7xl mx-auto">
                    <div className="animate-pulse space-y-6">
                        <div className="h-10 bg-secondary/50 rounded w-1/3" />
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-32 bg-secondary/50 rounded-xl" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    const statCards = [
        {
            title: "Total Orders",
            value: stats?.stats.totalOrders || 0,
            icon: ShoppingCart,
            color: "text-blue-500",
            bgColor: "bg-blue-500/10",
        },
        {
            title: "Total Revenue",
            value: `₹${Number(stats?.stats.totalRevenue || 0).toLocaleString()}`,
            icon: DollarSign,
            color: "text-green-500",
            bgColor: "bg-green-500/10",
        },
        {
            title: "Total Users",
            value: stats?.stats.totalUsers || 0,
            icon: Users,
            color: "text-purple-500",
            bgColor: "bg-purple-500/10",
        },
        {
            title: "Total Jerseys",
            value: stats?.stats.totalJerseys || 0,
            icon: Shirt,
            color: "text-orange-500",
            bgColor: "bg-orange-500/10",
        },
    ]

    return (
        <div className="min-h-screen bg-background pt-24 pb-12 px-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                    <div>
                        <h1 className="font-[var(--font-oswald)] text-4xl font-bold text-foreground">
                            ADMIN DASHBOARD
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Welcome back, {admin?.companyName}
                        </p>
                    </div>
                    <Button variant="outline" onClick={handleLogout} className="gap-2">
                        <LogOut className="h-4 w-4" />
                        Logout
                    </Button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {statCards.map((stat) => (
                        <div key={stat.title} className="bg-secondary/30 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                                </div>
                                <TrendingUp className="h-4 w-4 text-green-500" />
                            </div>
                            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                            <p className="text-sm text-muted-foreground">{stat.title}</p>
                        </div>
                    ))}
                </div>

                {/* Quick Links */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <Link href="/admin/orders" className="group">
                        <div className="bg-secondary/30 rounded-xl p-6 hover:bg-secondary/50 transition-colors">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-lg bg-blue-500/10">
                                        <Package className="h-6 w-6 text-blue-500" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-foreground">Manage Orders</h3>
                                        <p className="text-sm text-muted-foreground">View and update order status</p>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                            </div>
                        </div>
                    </Link>

                    <Link href="/admin/jerseys" className="group">
                        <div className="bg-secondary/30 rounded-xl p-6 hover:bg-secondary/50 transition-colors">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-lg bg-orange-500/10">
                                        <Shirt className="h-6 w-6 text-orange-500" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-foreground">Manage Jerseys</h3>
                                        <p className="text-sm text-muted-foreground">Add, edit, or remove designs</p>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                            </div>
                        </div>
                    </Link>
                </div>

                {/* Recent Orders */}
                <div className="bg-secondary/30 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="font-semibold text-lg text-foreground">Recent Orders</h2>
                        <Link href="/admin/orders" className="text-sm text-primary hover:underline">
                            View All
                        </Link>
                    </div>

                    {stats?.recentOrders && stats.recentOrders.length > 0 ? (
                        <div className="space-y-4">
                            {stats.recentOrders.map((order: any) => (
                                <div key={order.id} className="flex items-center justify-between p-4 bg-background/50 rounded-lg">
                                    <div>
                                        <p className="font-medium text-foreground">{order.user?.companyName || "Unknown"}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(order.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold text-foreground">₹{Number(order.total).toFixed(2)}</p>
                                        <span className={`text-xs px-2 py-1 rounded-full ${order.status === "PAID"
                                                ? "bg-green-500/20 text-green-500"
                                                : order.status === "PENDING"
                                                    ? "bg-yellow-500/20 text-yellow-500"
                                                    : "bg-red-500/20 text-red-500"
                                            }`}>
                                            {order.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">No recent orders</p>
                    )}
                </div>
            </div>
        </div>
    )
}
