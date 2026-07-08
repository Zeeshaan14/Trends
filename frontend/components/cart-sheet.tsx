"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { ShoppingBag, X, Minus, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
} from "@/components/ui/sheet"
import { useCart } from "@/context/cart-context"
import { Separator } from "@/components/ui/separator"

export function CartSheet() {
    const [open, setOpen] = useState(false)
    const router = useRouter()
    const { items, totalItems, totalPrice, updateQuantity, removeItem, isHydrated } = useCart()

    // Tax is currently 0 on the backend — will be enabled later

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <Button
                variant="ghost"
                size="icon"
                className="text-foreground relative"
                onClick={() => setOpen(true)}
            >
                <ShoppingBag className="h-5 w-5" />
                {isHydrated && totalItems > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                        {totalItems}
                    </span>
                )}
            </Button>

            <SheetContent className="w-full sm:max-w-lg flex flex-col">
                <SheetHeader>
                    <SheetTitle className="font-[var(--font-display)] text-2xl">
                        Shopping Cart
                    </SheetTitle>
                    <SheetDescription>
                        {totalItems === 0
                            ? "Your cart is empty"
                            : `${totalItems} ${totalItems === 1 ? "item" : "items"} in your cart`}
                    </SheetDescription>
                </SheetHeader>

                {items.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                        <div className="w-32 h-32 rounded-full bg-secondary/50 flex items-center justify-center">
                            <ShoppingBag className="w-16 h-16 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground text-center">
                            Your cart is empty. Start shopping to add items!
                        </p>
                        <Button
                            onClick={() => setOpen(false)}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                            Continue Shopping
                        </Button>
                    </div>
                ) : (
                    <>
                        <div className="flex-1 overflow-y-auto py-4 space-y-4">
                            {items.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex gap-4 bg-secondary/50 rounded-lg p-4"
                                >
                                    <div className="relative w-24 h-32 flex-shrink-0 rounded-md overflow-hidden bg-secondary">
                                        <Image
                                            src={item.image || "/placeholder.svg"}
                                            alt={item.name}
                                            fill
                                            className="object-cover"
                                        />
                                    </div>

                                    <div className="flex-1 flex flex-col justify-between">
                                        <div>
                                            <h3 className="font-semibold text-foreground line-clamp-1">
                                                {item.name}
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                                {item.player}
                                            </p>
                                            {item.size && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Size: {item.size}
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 bg-background rounded-md">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() =>
                                                        updateQuantity(item.id, item.quantity - 1)
                                                    }
                                                >
                                                    <Minus className="h-3 w-3" />
                                                </Button>
                                                <span className="text-sm font-medium w-8 text-center">
                                                    {item.quantity}
                                                </span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() =>
                                                        updateQuantity(item.id, item.quantity + 1)
                                                    }
                                                >
                                                    <Plus className="h-3 w-3" />
                                                </Button>
                                            </div>

                                            <span className="font-bold text-foreground">
                                                ₹{(item.price * item.quantity).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive/90"
                                        onClick={() => removeItem(item.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-4 pt-4 border-t border-border">
                            <div className="space-y-2">
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
                                        ₹{totalPrice.toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            <Button
                                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base h-12"
                                onClick={() => {
                                    setOpen(false)
                                    router.push("/checkout")
                                }}
                            >
                                Proceed to Checkout
                            </Button>

                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => setOpen(false)}
                            >
                                Continue Shopping
                            </Button>
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    )
}
