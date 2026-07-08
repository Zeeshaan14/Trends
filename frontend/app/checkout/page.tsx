"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Download, ShieldCheck, FileArchive } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCart } from "@/context/cart-context"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/components/ui/use-toast"
import { createOrder, verifyPayment, getOrderById } from "@/lib/api"
import { openRazorpayCheckout } from "@/lib/razorpay"
import { checkoutSchema } from "@/lib/validators"

export default function CheckoutPage() {
    const router = useRouter()
    const { items, totalItems, totalPrice, updateQuantity, removeItem, clearCart } = useCart()
    const [isProcessing, setIsProcessing] = useState(false)
    const [agreedToTerms, setAgreedToTerms] = useState(false)
    const razorpayRef = useRef<{ close: () => void } | null>(null)
    const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const paymentConfirmedRef = useRef(false) // prevents ondismiss from firing "Cancelled" after we close modal

    // Cleanup any running poll on unmount
    useEffect(() => {
        return () => {
            if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
        }
    }, [])
    const { toast } = useToast()

    // Tax is currently 0 on the backend — will be enabled later
    const finalTotal = totalPrice

    const [formData, setFormData] = useState({
        companyName: "",
        email: "",
        phone: "",
    })

    const [errors, setErrors] = useState<Record<string, string>>({})

    const isFormValid = formData.companyName.trim() !== "" &&
        formData.email.trim() !== "" &&
        formData.phone.trim() !== ""

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setFormData({
            ...formData,
            [name]: value,
        })
        // Clear field error when user starts typing
        if (errors[name]) {
            setErrors(prev => {
                const copy = { ...prev }
                delete copy[name]
                return copy
            })
        }
    }

    /**
     * Polls our backend every 3 seconds while Razorpay modal is open.
     * This is the reliable path for QR/GPay payments where Razorpay's
     * handler callback may not fire (payment confirmed out-of-band via webhook).
     */
    const startOrderPolling = (orderId: string, email: string) => {
        const MAX_ATTEMPTS = 40 // 40 × 3s = 2 minutes
        let attempts = 0

        const poll = async () => {
            attempts += 1
            console.log(`[Poll] Attempt ${attempts} — checking order ${orderId}`)
            try {
                const data = await getOrderById(orderId, email)
                console.log(`[Poll] Order status: ${data?.status}`)
                if (data && data.status === "PAID") {
                    console.log("[Poll] Payment confirmed! Closing modal and redirecting.")
                    if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
                    paymentConfirmedRef.current = true // prevent ondismiss cancel toast
                    razorpayRef.current?.close()
                    clearCart()
                    toast({
                        title: "Payment Confirmed! 🎉",
                        description: "Your order is confirmed. Redirecting...",
                    })
                    window.location.href = `/order/${orderId}`
                    return
                }
            } catch (err) {
                console.warn("[Poll] Error checking order status:", err)
            }

            if (attempts < MAX_ATTEMPTS) {
                pollTimerRef.current = setTimeout(poll, 3000)
            } else {
                console.warn("[Poll] Max attempts reached. Stopping poll.")
            }
        }

        // First poll after 5 seconds (give webhook time to arrive)
        console.log(`[Poll] Starting polling for order ${orderId} in 5s`)
        pollTimerRef.current = setTimeout(poll, 5000)
    }

    const handlePlaceOrder = async (e: React.FormEvent) => {
        e.preventDefault()

        // Validate form using Zod schema
        const result = checkoutSchema.safeParse(formData)
        if (!result.success) {
            const fieldErrors: Record<string, string> = {}
            result.error.issues.forEach((issue) => {
                const path = issue.path[0] as string
                fieldErrors[path] = issue.message
            })
            setErrors(fieldErrors)
            toast({
                title: "Invalid Input",
                description: Object.values(fieldErrors)[0] || "Please fill in all required fields correctly.",
                variant: "destructive",
            })
            return
        }

        setErrors({})

        if (!agreedToTerms) {
            toast({
                title: "Terms Required",
                description: "Please agree to the Terms and Conditions to proceed.",
            })
            return
        }

        setIsProcessing(true)

        try {
            // Create order via API
            const order = await createOrder({
                companyName: formData.companyName,
                email: formData.email,
                phone: formData.phone,
                items: items.map(item => ({
                    jerseyId: item.id,
                    quantity: item.quantity,
                })),
            })

            // Store email in localStorage for guest validation on the order status page
            if (typeof window !== "undefined") {
                localStorage.setItem("last_checkout_email", formData.email)
            }

            // Open Razorpay Checkout
            if (order.razorpayOrderId && order.razorpayKeyId) {
                const rzp = await openRazorpayCheckout({
                    key: order.razorpayKeyId,
                    amount: Math.round(order.total * 100),
                    currency: "INR",
                    name: "NuJerseys",
                    description: "Digital Design Purchase",
                    order_id: order.razorpayOrderId,
                    prefill: {
                        name: formData.companyName,
                        email: formData.email,
                        contact: formData.phone,
                    },
                    theme: {
                        color: "#0f172a",
                    },
                    /**
                     * handler: fast path for card / UPI-inline / netbanking.
                     * For QR/GPay the polling below is the reliable path.
                     */
                    handler: async function (response) {
                        // Stop polling — handler fired, so we have the payment IDs
                        if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
                        console.log("[Razorpay] handler fired, verifying payment...")
                        try {
                            setIsProcessing(true)
                            await verifyPayment({
                                orderId: order.id,
                                razorpayOrderId: response.razorpay_order_id,
                                razorpayPaymentId: response.razorpay_payment_id,
                                razorpaySignature: response.razorpay_signature,
                            })
                            console.log("[Razorpay] verifyPayment succeeded, redirecting")
                            paymentConfirmedRef.current = true
                            clearCart()
                            toast({
                                title: "Payment Successful!",
                                description: "Your order is confirmed and download links are ready.",
                            })
                            window.location.href = `/order/${order.id}`
                        } catch (verifyError: any) {
                            setIsProcessing(false)
                            toast({
                                title: "Verification Failed",
                                description: verifyError.message || "Payment verification failed. Please contact support.",
                                variant: "destructive"
                            })
                            window.location.href = `/order/${order.id}`
                        }
                    },
                    modal: {
                        ondismiss: function () {
                            // If payment was already confirmed (by handler or polling), skip cancel logic
                            if (paymentConfirmedRef.current) return
                            // User manually closed the modal — stop polling
                            if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
                            console.log("[Razorpay] modal dismissed by user")
                            setIsProcessing(false)
                            toast({
                                title: "Payment Cancelled",
                                description: "You can retry payment from the order page.",
                            })
                            window.location.href = `/order/${order.id}`
                        }
                    }
                })

                // Store rzp instance and start polling as the reliable path for QR/GPay
                razorpayRef.current = rzp
                startOrderPolling(order.id, formData.email)

            } else {
                throw new Error("Razorpay integration details missing from server.")
            }

        } catch (error: any) {
            setIsProcessing(false)
            toast({
                title: "Order Failed",
                description: error.message || "Something went wrong. Please try again.",
                variant: "destructive"
            })
        }
    }

    // Redirect if cart is empty
    if (items.length === 0 && !isProcessing) {
        return (
            <div className="min-h-screen bg-background pt-24 pb-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col items-center justify-center py-16">
                        <h1 className="font-[var(--font-oswald)] text-4xl font-bold text-foreground mb-4">
                            Your Cart is Empty
                        </h1>
                        <p className="text-muted-foreground mb-8">
                            Add some designs to your cart before checking out.
                        </p>
                        <Button
                            onClick={() => router.push("/")}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                            Browse Designs
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background pt-24 pb-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/"
                        className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors mb-4"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Continue Browsing
                    </Link>
                    <h1 className="font-[var(--font-oswald)] text-4xl sm:text-5xl font-bold text-foreground">
                        CHECKOUT
                    </h1>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column - Forms */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Digital Product Notice */}
                        <div className="bg-primary/10 border border-primary/20 rounded-xl p-6">
                            <div className="flex items-start gap-4">
                                <div className="p-3 rounded-lg bg-primary/20">
                                    <FileArchive className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-foreground mb-2">Digital Download</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Your design files will be available for immediate download after payment.
                                        Each design includes Adobe Illustrator (.ai) and CorelDraw (.cdr) files in a ZIP archive.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Contact Information */}
                        <div className="bg-secondary/30 rounded-xl p-6">
                            <h2 className="font-[var(--font-oswald)] text-2xl font-bold text-foreground mb-6">
                                Contact Information
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-2">
                                        Company Name *
                                    </label>
                                    <Input
                                        type="text"
                                        name="companyName"
                                        value={formData.companyName}
                                        onChange={handleInputChange}
                                        placeholder="Enter your company name"
                                        required
                                        className={`bg-background ${errors.companyName ? "border-red-500 ring-1 ring-red-500" : "border-border"}`}
                                    />
                                    {errors.companyName && (
                                        <p className="text-red-500 text-xs mt-1">{errors.companyName}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-2">
                                        Email * <span className="text-muted-foreground font-normal">(Download link will be sent here)</span>
                                    </label>
                                    <Input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        placeholder="Enter your email address"
                                        required
                                        className={`bg-background ${errors.email ? "border-red-500 ring-1 ring-red-500" : "border-border"}`}
                                    />
                                    {errors.email && (
                                        <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-2">
                                        Phone *
                                    </label>
                                    <Input
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                        placeholder="Enter your phone number"
                                        required
                                        className={`bg-background ${errors.phone ? "border-red-500 ring-1 ring-red-500" : "border-border"}`}
                                    />
                                    {errors.phone && (
                                        <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Order Summary */}
                    <div className="lg:col-span-1">
                        <div className="bg-secondary/30 rounded-xl p-6 sticky top-24">
                            <h2 className="font-[var(--font-oswald)] text-2xl font-bold text-foreground mb-6">
                                Order Summary
                            </h2>

                            {/* Cart Items */}
                            <div className="space-y-4 mb-6 max-h-64 overflow-y-auto">
                                {items.map((item) => (
                                    <div key={item.id} className="flex gap-4">
                                        <div className="relative w-20 h-24 flex-shrink-0 rounded-md overflow-hidden bg-secondary">
                                            <Image
                                                src={item.image || "/placeholder.svg"}
                                                alt={item.name}
                                                fill
                                                className="object-cover"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-foreground text-sm line-clamp-1">
                                                {item.name}
                                            </h3>
                                            <p className="text-xs text-muted-foreground">{item.player}</p>
                                            <p className="text-xs text-primary mt-1">Digital Design File</p>
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-xs text-muted-foreground">
                                                    Qty: {item.quantity}
                                                </span>
                                                <span className="font-bold text-sm text-foreground">
                                                    ₹{(item.price * item.quantity).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <Separator className="my-4" />

                            {/* Price Breakdown */}
                            <div className="space-y-2 mb-6">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span className="text-foreground font-medium">
                                        ₹{totalPrice.toFixed(2)}
                                    </span>
                                </div>
                                <Separator className="my-2" />
                                <div className="flex justify-between">
                                    <span className="font-bold text-lg">Total</span>
                                    <span className="font-bold text-lg text-primary">
                                        ₹{finalTotal.toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            {/* Features */}
                            <div className="space-y-3 mb-6 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4 text-primary" />
                                    <span>Secure Payment</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Download className="h-4 w-4 text-primary" />
                                    <span>Instant Download After Payment</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <FileArchive className="h-4 w-4 text-primary" />
                                    <span>AI + CDR Files Included</span>
                                </div>
                            </div>

                            {/* Terms Agreement */}
                            <div className="flex items-start gap-3 mb-6 p-3 bg-background/50 rounded-lg">
                                <Checkbox
                                    id="terms"
                                    checked={agreedToTerms}
                                    onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                                    className="mt-0.5"
                                />
                                <label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer">
                                    I agree to the{" "}
                                    <Link href="/terms" className="text-primary hover:underline" target="_blank">
                                        Terms and Conditions
                                    </Link>{" "}
                                    and{" "}
                                    <Link href="/privacy-policy" className="text-primary hover:underline" target="_blank">
                                        Privacy Policy
                                    </Link>
                                    . I understand that digital products are non-refundable.
                                </label>
                            </div>

                            {/* Place Order Button */}
                            <Button
                                onClick={handlePlaceOrder}
                                disabled={isProcessing || !agreedToTerms}
                                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base h-12 disabled:opacity-50"
                            >
                                {isProcessing ? "Processing..." : `Pay with Razorpay ₹${finalTotal.toFixed(0)}`}
                            </Button>

                            <p className="text-xs text-center text-muted-foreground mt-4">
                                Download link will be sent to your email
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
