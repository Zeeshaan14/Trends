"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from "react"
import { useToast } from "@/components/ui/use-toast"

const CART_STORAGE_KEY = "nujerseys-cart"

// SSR-safe localStorage helpers
function getStoredCart(): CartItem[] {
    if (typeof window === "undefined") return []
    try {
        const stored = localStorage.getItem(CART_STORAGE_KEY)
        return stored ? JSON.parse(stored) : []
    } catch {
        return []
    }
}

function setStoredCart(items: CartItem[]): void {
    if (typeof window === "undefined") return
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
    } catch {
        // Silently fail if localStorage is full or unavailable
    }
}

export interface CartItem {
    id: number
    name: string
    player: string
    price: number
    image: string
    quantity: number
    size?: string
}

interface CartContextType {
    items: CartItem[]
    addItem: (item: Omit<CartItem, "quantity">) => void
    removeItem: (id: number) => void
    updateQuantity: (id: number, quantity: number) => void
    clearCart: () => void
    totalItems: number
    totalPrice: number
    isHydrated: boolean
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([])
    const [isHydrated, setIsHydrated] = useState(false)
    const { toast } = useToast()

    // Load cart from localStorage on mount (client-side only)
    useEffect(() => {
        const stored = getStoredCart()
        if (stored.length > 0) {
            setItems(stored)
        }
        setIsHydrated(true)
    }, [])

    // Persist cart to localStorage whenever items change
    useEffect(() => {
        if (isHydrated) {
            setStoredCart(items)
        }
    }, [items, isHydrated])

    const addItem = useCallback((item: Omit<CartItem, "quantity">) => {
        setItems((prevItems) => {
            const existingItem = prevItems.find((i) => i.id === item.id)
            if (existingItem) {
                return prevItems.map((i) =>
                    i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
                )
            }
            return [...prevItems, { ...item, quantity: 1 }]
        })
        toast({
            title: "Added to cart",
            description: `${item.name} has been added to your cart.`,
        })
    }, [toast])

    const removeItem = useCallback((id: number) => {
        setItems((prevItems) => prevItems.filter((item) => item.id !== id))
    }, [])

    const updateQuantity = useCallback((id: number, quantity: number) => {
        if (quantity <= 0) {
            removeItem(id)
            return
        }
        setItems((prevItems) =>
            prevItems.map((item) =>
                item.id === id ? { ...item, quantity } : item
            )
        )
    }, [removeItem])

    const clearCart = useCallback(() => {
        setItems([])
    }, [])

    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
    const totalPrice = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
    )

    const value = useMemo(() => ({
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
        isHydrated,
    }), [items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice, isHydrated])

    return (
        <CartContext.Provider value={value}>
            {children}
        </CartContext.Provider>
    )
}

export function useCart() {
    const context = useContext(CartContext)
    if (!context) {
        throw new Error("useCart must be used within CartProvider")
    }
    return context
}

