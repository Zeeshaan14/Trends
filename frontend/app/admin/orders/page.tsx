"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Package, Filter, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getAdminOrders, AdminOrder } from "@/lib/api"
import { useAdminSession } from "@/hooks/use-admin-session"

export default function AdminOrdersPage() {
    const { admin, token } = useAdminSession(true)
    const [orders, setOrders] = useState<AdminOrder[]>([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState<string | null>(null)

    useEffect(() => {
        if (!admin || !token) return

        setLoading(true)
        getAdminOrders(token, statusFilter || undefined)
            .then((res) => setOrders(res.data))
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [admin, token, statusFilter])

    const statusColors: Record<string, string> = {
        PENDING: "bg-yellow-500/20 text-yellow-500",
        PAID: "bg-green-500/20 text-green-500",
        CANCELLED: "bg-red-500/20 text-red-500",
    }

    return (
        <div className="min-h-screen bg-background pt-24 pb-12 px-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/admin/dashboard"
                        className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Dashboard
                    </Link>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <h1 className="font-[var(--font-oswald)] text-4xl font-bold text-foreground">
                            ORDERS
                        </h1>
                        <div className="flex items-center gap-2">
                            <Button
                                variant={statusFilter === null ? "default" : "outline"}
                                size="sm"
                                onClick={() => setStatusFilter(null)}
                            >
                                All
                            </Button>
                            <Button
                                variant={statusFilter === "PENDING" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setStatusFilter("PENDING")}
                            >
                                Pending
                            </Button>
                            <Button
                                variant={statusFilter === "PAID" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setStatusFilter("PAID")}
                            >
                                Paid
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Orders Table */}
                <div className="bg-secondary/30 rounded-xl overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center">
                            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="p-8 text-center">
                            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">No orders found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-background/50">
                                    <tr>
                                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Order ID</th>
                                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Customer</th>
                                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Items</th>
                                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Total</th>
                                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.map((order) => (
                                        <tr key={order.id} className="border-t border-border hover:bg-background/30">
                                            <td className="p-4">
                                                <span className="font-mono text-sm text-foreground">
                                                    {order.id.slice(0, 8)}...
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <p className="font-medium text-foreground">{order.user.companyName}</p>
                                                <p className="text-xs text-muted-foreground">{order.user.email}</p>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex -space-x-2">
                                                    {order.items.slice(0, 3).map((item) => (
                                                        <div key={item.id} className="relative w-8 h-10 rounded overflow-hidden border-2 border-background">
                                                            <Image
                                                                src={item.jersey.image || "/placeholder.svg"}
                                                                alt={item.jersey.name}
                                                                fill
                                                                className="object-cover"
                                                            />
                                                        </div>
                                                    ))}
                                                    {order.items.length > 3 && (
                                                        <div className="w-8 h-10 rounded bg-secondary flex items-center justify-center text-xs text-muted-foreground border-2 border-background">
                                                            +{order.items.length - 3}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="font-semibold text-foreground">
                                                    ₹{Number(order.total).toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className={`text-xs px-2 py-1 rounded-full ${statusColors[order.status] || ""}`}>
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm text-muted-foreground">
                                                {new Date(order.createdAt).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
