"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import Link from "next/link"
import { Heart, ShoppingBag, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useCart } from "@/context/cart-context"

interface JerseyCardProps {
    id: number
    name: string
    player: string
    price: number
    originalPrice?: number | null
    rating: number
    reviews: number
    image: string
    badge?: string | null
    badgeColor?: string | null
    index?: number
}

const BADGE_COLOR_MAP: Record<string, string> = {
    red: "bg-red-500 hover:bg-red-600 text-white border-none",
    blue: "bg-blue-500 hover:bg-blue-600 text-white border-none",
    green: "bg-green-500 hover:bg-green-600 text-white border-none",
    primary: "bg-primary hover:bg-primary/90 text-primary-foreground border-none",
    orange: "bg-orange-500 hover:bg-orange-600 text-white border-none",
    yellow: "bg-yellow-500 hover:bg-yellow-600 text-black border-none",
    purple: "bg-purple-500 hover:bg-purple-600 text-white border-none",
    slate: "bg-slate-500 hover:bg-slate-600 text-white border-none",
    default: "bg-primary hover:bg-primary/90 text-primary-foreground border-none",
}

function getBadgeColorClass(color?: string | null): string {
    if (!color) return BADGE_COLOR_MAP.default
    const clean = color.toLowerCase().trim()
    return BADGE_COLOR_MAP[clean] || BADGE_COLOR_MAP.default
}

export function JerseyCard({
    id,
    name,
    player,
    price,
    originalPrice,
    rating,
    reviews,
    image,
    badge,
    badgeColor,
    index = 0,
}: JerseyCardProps) {
    const { addItem } = useCart()

    const handleQuickAdd = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        addItem({
            id,
            name,
            player,
            price,
            image,
        })
    }

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
            className="group"
        >
            <div className="relative bg-secondary rounded-xl overflow-hidden">
                <Link href={`/jerseys/${id}`} className="block">
                    {/* Badge */}
                    {badge && (
                        <div className="absolute top-3 left-3 z-10">
                            <Badge className={`${getBadgeColorClass(badgeColor)} text-[10px] font-bold tracking-wider uppercase px-2.5 py-1`}>
                                {badge}
                            </Badge>
                        </div>
                    )}

                    {/* Image */}
                    <div className="relative aspect-[3/4] overflow-hidden">
                        <Image
                            src={image || "/placeholder.svg"}
                            alt={name}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                    </div>
                </Link>

                {/* Wishlist Button */}
                <button className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background">
                    <Heart className="h-4 w-4 text-foreground" />
                </button>

                {/* Quick Add */}
                <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300 pointer-events-none">
                    <Button
                        onClick={handleQuickAdd}
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg pointer-events-auto cursor-pointer"
                    >
                        <ShoppingBag className="h-4 w-4 mr-2" />
                        Quick Add
                    </Button>
                </div>
            </div>

            {/* Product Info */}
            <div className="mt-4 space-y-2">
                <Link href={`/jerseys/${id}`} className="block group/link">

                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {name}
                    </h3>
                    <p className="text-sm text-muted-foreground">{player}</p>
                    <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-foreground">₹{price}</span>
                        {originalPrice && (
                            <span className="text-sm text-muted-foreground line-through">
                                ₹{originalPrice}
                            </span>
                        )}
                    </div>
                </Link>
            </div>
        </motion.div>
    )
}
