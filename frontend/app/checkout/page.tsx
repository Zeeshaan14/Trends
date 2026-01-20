"use client"

import { useState } from "react"
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
import { createOrder } from "@/lib/api"

export default function CheckoutPage() {
    const router = useRouter()
    const { items, totalItems, totalPrice, updateQuantity, removeItem, clearCart } = useCart()
    const [isProcessing, setIsProcessing] = useState(false)
    const [agreedToTerms, setAgreedToTerms] = useState(false)
    const { toast } = useToast()

    const tax = totalPrice * 0 // GST 18%
    const finalTotal = totalPrice + tax

    const [formData, setFormData] = useState({
        companyName: "",
        email: "",
        phone: "",
    })

    const [errors, setErrors] = useState({
        companyName: false,
        email: false,
        phone: false,
    })

    const isFormValid = formData.companyName.trim() !== "" &&
        formData.email.trim() !== "" &&
        formData.phone.trim() !== ""

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setFormData({
            ...formData,
            [name]: value,
        })
        // Clear error when user starts typing
        if (value.trim() !== "") {
            setErrors(prev => ({ ...prev, [name]: false }))
        }
    }

    const handlePlaceOrder = async (e: React.FormEvent) => {
        e.preventDefault()

        // Validate form and show errors
        const newErrors = {
            companyName: formData.companyName.trim() === "",
            email: formData.email.trim() === "",
            phone: formData.phone.trim() === "",
        }
        setErrors(newErrors)

        // Check if there are any errors
        if (newErrors.companyName || newErrors.email || newErrors.phone) {
            toast({
                title: "Required Fields Missing",
                description: "Please fill in all required fields.",
            })
            return
        }

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

            // Clear cart and show success
            clearCart()
            toast({
                title: "Order Placed Successfully!",
                description: "Check your email for the download link.",
            })

            // Redirect to order confirmation page (or home for now)
            router.push(`/order/${order.id}`)
        } catch (error: any) {
            toast({
                title: "Order Failed",
                description: error.message || "Something went wrong. Please try again.",
            })
        } finally {
            setIsProcessing(false)
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
                                        <p className="text-red-500 text-xs mt-1">Company name is required</p>
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
                                        <p className="text-red-500 text-xs mt-1">Email is required</p>
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
                                        <p className="text-red-500 text-xs mt-1">Phone number is required</p>
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
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">GST (18%)</span>
                                    <span className="text-foreground font-medium">
                                        ₹{tax.toFixed(2)}
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
                                {isProcessing ? "Processing..." : "Complete Purchase"}
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
