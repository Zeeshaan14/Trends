"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { CheckCircle, Download, ArrowRight, Package, AlertCircle, RefreshCw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import { verifyPayment, getDesignDownloadUrl, getOrderById } from "@/lib/api"
import { openRazorpayCheckout } from "@/lib/razorpay"
import { useCart } from "@/context/cart-context"

interface OrderItem {
    id: string
    jerseyId: number
    quantity: number
    price: number
    jersey: {
        id: number
        name: string
        player: string
        image: string
        hasDesignFile?: boolean
    }
}

interface Order {
    id: string
    status: string
    subtotal: number
    tax: number
    total: number
    razorpayOrderId?: string
    razorpayKeyId?: string
    items: OrderItem[]
    user: {
        companyName: string
        email: string
        phone: string
    }
    createdAt: string
}

export default function OrderConfirmationPage() {
    const params = useParams()
    const searchParams = useSearchParams()
    const orderId = params.id as string
    const router = useRouter()
    const emailFromUrl = searchParams ? searchParams.get("email") : null
    const { toast } = useToast()
    const { clearCart } = useCart()
    const [order, setOrder] = useState<Order | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isRetrying, setIsRetrying] = useState(false)
    const [downloadingJerseyId, setDownloadingJerseyId] = useState<number | null>(null)

    const handleRetryPayment = async () => {
        if (!order || !order.razorpayOrderId || !order.razorpayKeyId) {
            toast({
                title: "Error",
                description: "Missing payment details. Please contact support.",
                variant: "destructive"
            })
            return
        }

        setIsRetrying(true)

        try {
            await openRazorpayCheckout({
                key: order.razorpayKeyId,
                amount: Math.round(order.total * 100),
                currency: "INR",
                name: "NuJerseys",
                description: "Digital Design Purchase",
                order_id: order.razorpayOrderId,
                prefill: {
                    name: order.user.companyName,
                    email: order.user.email,
                    contact: order.user.phone,
                },
                theme: {
                    color: "#0f172a",
                },
                handler: async function (response) {
                    try {
                        await verifyPayment({
                            orderId: order.id,
                            razorpayOrderId: response.razorpay_order_id,
                            razorpayPaymentId: response.razorpay_payment_id,
                            razorpaySignature: response.razorpay_signature,
                        })

                        clearCart()
                        toast({
                            title: "Payment Successful!",
                            description: "Your order is confirmed and download links are ready.",
                        })
                        // Refetch the order to get the updated status without a hard reload
                        setIsRetrying(false)
                        await fetchOrder()
                    } catch (verifyError: any) {
                        toast({
                            title: "Verification Failed",
                            description: verifyError.message || "Payment verification failed. Please contact support.",
                            variant: "destructive"
                        })
                        setIsRetrying(false)
                    }
                },
                modal: {
                    ondismiss: function () {
                        setIsRetrying(false)
                        toast({
                            title: "Payment Cancelled",
                            description: "You can retry payment anytime.",
                        })
                    }
                }
            })
        } catch (error: any) {
            setIsRetrying(false)
            toast({
                title: "Error",
                description: error.message || "Failed to initialize payment gateway.",
                variant: "destructive"
            })
        }
    }

    const handleDownload = async (jerseyId: number) => {
        if (!order?.user?.email) {
            toast({
                title: "Error",
                description: "Order details not loaded. Please refresh the page.",
                variant: "destructive"
            })
            return
        }

        setDownloadingJerseyId(jerseyId)

        try {
            const result = await getDesignDownloadUrl(orderId, jerseyId, order.user.email)
            // Trigger download directly — no redirect, no new tab flicker
            const link = document.createElement("a")
            link.href = result.download_url
            link.setAttribute("download", "")
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        } catch (err: any) {
            toast({
                title: "Download Failed",
                description: err.message || "Failed to generate download link.",
                variant: "destructive"
            })
        } finally {
            setDownloadingJerseyId(null)
        }
    }

    const fetchOrder = async () => {
        try {
            const lastEmail = (typeof window !== "undefined" ? localStorage.getItem("last_checkout_email") : "") || ""
            if (!lastEmail) {
                throw new Error("Email verification required. Please use the link sent to your email or contact support.")
            }
            const data = await getOrderById(orderId, lastEmail)
            setOrder(data)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        // If email is in URL, store it and strip it from the URL
        if (emailFromUrl) {
            if (typeof window !== "undefined") {
                localStorage.setItem("last_checkout_email", emailFromUrl)
            }
            // Strip the email query param from URL
            router.replace(`/order/${orderId}`)
            return // Stop execution here; the router replacement triggers state update
        }

        fetchOrder()
    }, [orderId, emailFromUrl, router])

    if (loading) {
        return (
            <div className="min-h-screen bg-background pt-32 pb-16 px-4">
                <div className="max-w-3xl mx-auto text-center">
                    <div className="animate-pulse space-y-6">
                        <div className="h-16 w-16 bg-secondary/50 rounded-full mx-auto" />
                        <div className="h-8 bg-secondary/50 rounded w-1/2 mx-auto" />
                        <div className="h-4 bg-secondary/50 rounded w-1/3 mx-auto" />
                    </div>
                </div>
            </div>
        )
    }

    if (error || !order) {
        return (
            <div className="min-h-screen bg-background pt-32 pb-16 px-4">
                <div className="max-w-3xl mx-auto text-center">
                    <h1 className="font-[var(--font-oswald)] text-4xl font-bold text-foreground mb-4">
                        Order Not Found
                    </h1>
                    <p className="text-muted-foreground mb-8">{error || "The order could not be found."}</p>
                    <Link href="/">
                        <Button>Return Home</Button>
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background pt-32 pb-16 px-4">
            <div className="max-w-3xl mx-auto">
                {/* Status Header */}
                <div className="text-center mb-12">
                    {order.status === "PAID" ? (
                        <>
                            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20 mb-6">
                                <CheckCircle className="h-10 w-10 text-green-500" />
                            </div>
                            <h1 className="font-[var(--font-oswald)] text-4xl sm:text-5xl font-bold text-foreground mb-4">
                                ORDER CONFIRMED!
                            </h1>
                            <p className="text-muted-foreground text-lg">
                                Thank you for your purchase, {order.user.companyName}
                            </p>
                        </>
                    ) : (
                        <>
                            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-yellow-500/20 mb-6">
                                <AlertCircle className="h-10 w-10 text-yellow-500" />
                            </div>
                            <h1 className="font-[var(--font-oswald)] text-4xl sm:text-5xl font-bold text-foreground mb-4">
                                PAYMENT PENDING
                            </h1>
                            <p className="text-muted-foreground text-lg">
                                Complete your payment to get your designs, {order.user.companyName}
                            </p>
                        </>
                    )}
                    <p className="text-sm text-muted-foreground mt-2">
                        Order ID: <span className="font-mono text-foreground">{order.id}</span>
                    </p>
                </div>

                {/* Order Details Card */}
                <div className="bg-secondary/30 rounded-xl p-6 mb-8">
                    <div className="flex items-center gap-3 mb-6">
                        <Package className="h-5 w-5 text-primary" />
                        <h2 className="font-semibold text-lg text-foreground">Order Details</h2>
                    </div>

                    {/* Order Items */}
                    <div className="space-y-4 mb-6">
                        {order.items.map((item) => (
                            <div key={item.id} className="flex gap-4 p-4 bg-background/50 rounded-lg">
                                <div className="relative w-16 h-20 flex-shrink-0 rounded-md overflow-hidden bg-secondary">
                                    <Image
                                        src={item.jersey.image || "/placeholder.svg"}
                                        alt={item.jersey.name}
                                        fill
                                        className="object-cover"
                                    />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-foreground">{item.jersey.name}</h3>
                                    <p className="text-sm text-muted-foreground">{item.jersey.player}</p>
                                    <div className="flex items-center justify-between mt-2">
                                        <span className="text-xs text-muted-foreground">Qty: {item.quantity}</span>
                                        <span className="font-semibold text-foreground">₹{Number(item.price).toFixed(2)}</span>
                                    </div>
                                    {order.status === "PAID" && item.jersey.hasDesignFile && (
                                        <div className="mt-3">
                                            <Button
                                                size="sm"
                                                className="w-full sm:w-auto"
                                                onClick={() => handleDownload(item.jersey.id)}
                                                disabled={downloadingJerseyId === item.jersey.id}
                                            >
                                                {downloadingJerseyId === item.jersey.id ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Generating Link...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Download className="mr-2 h-4 w-4" />
                                                        Download Design
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <Separator className="my-4" />

                    {/* Price Summary */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span className="text-foreground">₹{Number(order.subtotal).toFixed(2)}</span>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex justify-between">
                            <span className="font-bold text-lg">Total</span>
                            <span className="font-bold text-lg text-primary">₹{Number(order.total).toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Download Notice */}
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-6 mb-8">
                    <div className="flex items-start gap-4">
                        <div className="p-3 rounded-lg bg-primary/20">
                            <Download className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground mb-2">Download Information</h3>
                            <p className="text-sm text-muted-foreground">
                                {order.status === "PAID"
                                    ? "Your design files are ready for download. Check your email for the download links."
                                    : "Once payment is confirmed, download links will be sent to your email at " + order.user.email
                                }
                            </p>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    {order.status === "PENDING" && (
                        <Button 
                            size="lg" 
                            className="w-full sm:w-auto bg-primary"
                            onClick={handleRetryPayment}
                            disabled={isRetrying}
                        >
                            {isRetrying ? (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                "Pay Now"
                            )}
                        </Button>
                    )}
                    <Link href="/">
                        <Button variant="outline" size="lg" className="w-full sm:w-auto">
                            Continue Shopping
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    )
}
