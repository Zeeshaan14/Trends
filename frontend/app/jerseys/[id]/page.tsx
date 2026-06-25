"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter, notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"
import { Star, Minus, Plus, ShoppingBag, Heart, ChevronRight, Truck, ShieldCheck, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getJerseyById, getJerseys } from "@/lib/api"
import { Jersey } from "@/lib/types"
import { JerseyCard } from "@/components/jersey-card"
import { useCart } from "@/context/cart-context"

export default function JerseyPage() {
    const params = useParams()
    const router = useRouter()
    const id = params.id as string

    const [jersey, setJersey] = useState<Jersey | null>(null)
    const [relatedJerseys, setRelatedJerseys] = useState<Jersey[]>([])
    const [loading, setLoading] = useState(true)
    const [notFoundState, setNotFoundState] = useState(false)
    const { addItem, clearCart } = useCart()

    useEffect(() => {
        async function loadData() {
            try {
                const jerseyData = await getJerseyById(parseInt(id))
                setJersey(jerseyData)

                // Fetch related jerseys from same category
                const relatedData = await getJerseys({ categoryId: jerseyData.categoryId, limit: 5 })
                setRelatedJerseys(relatedData.data.filter((j) => j.id !== jerseyData.id).slice(0, 4))
            } catch (error) {
                console.error("Failed to load jersey:", error)
                setNotFoundState(true)
            } finally {
                setLoading(false)
            }
        }

        loadData()
    }, [id])

    if (notFoundState) {
        notFound()
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-background pt-24 pb-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-pulse">
                        <div className="aspect-square bg-secondary/50 rounded-2xl" />
                        <div className="space-y-6">
                            <div className="h-12 bg-secondary/50 rounded w-3/4" />
                            <div className="h-6 bg-secondary/50 rounded w-1/2" />
                            <div className="h-8 bg-secondary/50 rounded w-1/4" />
                            <div className="h-32 bg-secondary/50 rounded" />
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (!jersey) return null

    const handleDownload = () => {
        clearCart()
        addItem({
            id: jersey.id,
            name: jersey.name,
            player: jersey.player,
            price: Number(jersey.price),
            image: jersey.image,
        })
        router.push("/checkout")
    }

    const price = Number(jersey.price)
    const originalPrice = jersey.originalPrice ? Number(jersey.originalPrice) : null

    return (
        <div className="min-h-screen bg-background pt-24 pb-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* Breadcrumb */}
                <nav className="flex items-center text-sm text-muted-foreground mb-8">
                    <Link href="/" className="hover:text-primary transition-colors">Home</Link>
                    <ChevronRight className="h-4 w-4 mx-2" />
                    <Link href="/categories" className="hover:text-primary transition-colors">Categories</Link>
                    <ChevronRight className="h-4 w-4 mx-2" />
                    <Link href={`/categories/${jersey.categoryId}`} className="hover:text-primary transition-colors uppercase">{jersey.categoryId}</Link>
                    <ChevronRight className="h-4 w-4 mx-2" />
                    <span className="text-foreground font-medium truncate">{jersey.name}</span>
                </nav>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
                    {/* Left Column - Image */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5 }}
                        className="relative aspect-square bg-secondary/30 rounded-2xl overflow-hidden"
                    >
                        {jersey.badge && (
                            <div className="absolute top-4 left-4 z-10">
                                <Badge className={`${jersey.badgeColor} text-sm font-semibold px-3 py-1`}>
                                    {jersey.badge}
                                </Badge>
                            </div>
                        )}
                        <Image
                            src={jersey.image || "/placeholder.svg"}
                            alt={jersey.name}
                            fill
                            className="object-contain p-8 hover:scale-105 transition-transform duration-500"
                            priority
                        />
                    </motion.div>

                    {/* Right Column - Product Details */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="flex flex-col"
                    >
                        <h1 className="font-[var(--font-oswald)] text-4xl sm:text-5xl font-bold text-foreground tracking-tight mb-2">
                            {jersey.name}
                        </h1>
                        <p className="text-lg text-muted-foreground mb-4">{jersey.player}</p>



                        <div className="flex items-center gap-4 mb-8">
                            <span className="text-3xl font-bold text-foreground">
                                ₹{price}
                            </span>
                            {originalPrice && (
                                <span className="text-xl text-muted-foreground line-through">
                                    ₹{originalPrice}
                                </span>
                            )}
                            {originalPrice && (
                                <Badge variant="destructive">
                                    Save ₹{(originalPrice - price).toFixed(2)}
                                </Badge>
                            )}
                        </div>

                        <p className="text-muted-foreground mb-8 leading-relaxed">
                            Elevate your team's look with this premium digital jersey design.
                            Fully customizable and ready for sublimation printing, this high-resolution vector
                            file gives you complete control over colors, logos, and player details.
                        </p>

                        {/* Actions */}
                        <div className="flex flex-row flex-wrap gap-3 sm:gap-4 mb-8">
                            <Button
                                size="lg"
                                className="flex-1 min-w-[140px] bg-primary hover:bg-primary/90 text-primary-foreground gap-2 h-11"
                                onClick={handleDownload}
                            >
                                <Download className="h-5 w-5" />
                                <span>Download</span>
                            </Button>

                            <Button variant="outline" size="icon" className="h-11 w-11 shrink-0">
                                <Heart className="h-5 w-5" />
                            </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground mb-8">
                            <div className="flex items-center gap-2">
                                <Truck className="h-4 w-4" />
                                <span>Instant Digital Download</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4" />
                                <span>Official Licensed Product</span>
                            </div>
                        </div>

                        <div className="border-t border-border pt-6 mt-auto">
                            <div className="flex gap-2 text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">SKU:</span>
                                <span>JR-{jersey.id}00{jersey.id}</span>
                            </div>
                            <div className="flex gap-2 text-sm text-muted-foreground mt-1">
                                <span className="font-medium text-foreground">Category:</span>
                                <span className="capitalize">{jersey.categoryId}</span>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Tabs Section */}
                <div className="mt-16 lg:mt-24">
                    <Tabs defaultValue="description" className="w-full">
                        <TabsList className="w-full justify-start border-b border-border bg-transparent p-0 mb-8 rounded-none">
                            <TabsTrigger
                                value="description"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                            >
                                Description
                            </TabsTrigger>
                            <TabsTrigger
                                value="additional"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                            >
                                Additional Information
                            </TabsTrigger>

                        </TabsList>
                        <TabsContent value="description" className="animate-in fade-in-50 duration-500">
                            <div className="prose prose-invert max-w-none text-muted-foreground">
                                <p>
                                    Get production-ready with the {jersey.name} digital design file. Crafted with precision for sportswear manufacturers and team managers, 
                                    this premium vector template ensures high-quality sublimation printing with sharp, scalable graphics.
                                </p>
                                <ul className="list-disc pl-5 mt-4 space-y-2">
                                    <li>100% Vector format (fully scalable without quality loss)</li>
                                    <li>Ready for Sublimation Printing</li>
                                    <li>Easily editable colors, text, and logos</li>
                                    <li>Organized layers for quick customization</li>
                                    <li>Includes front, back, and side panel layouts</li>
                                </ul>
                            </div>
                        </TabsContent>
                        <TabsContent value="additional" className="animate-in fade-in-50 duration-500">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                                <div className="flex justify-between py-2 border-b border-border">
                                    <span className="font-medium">File Format</span>
                                    <span className="text-muted-foreground">.AI, .CDR, .EPS, .PDF</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-border">
                                    <span className="font-medium">Color Mode</span>
                                    <span className="text-muted-foreground">CMYK (Print Ready)</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-border">
                                    <span className="font-medium">Delivery</span>
                                    <span className="text-muted-foreground">Instant Download (ZIP)</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-border">
                                    <span className="font-medium">License</span>
                                    <span className="text-muted-foreground">Commercial Use</span>
                                </div>
                            </div>
                        </TabsContent>

                    </Tabs>
                </div>

                {/* Related Products */}
                {relatedJerseys.length > 0 && (
                    <div className="mt-16 lg:mt-24">
                        <h2 className="font-[var(--font-oswald)] text-3xl font-bold mb-8">RELATED PRODUCTS</h2>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                            {relatedJerseys.map((relatedJersey, index) => (
                                <JerseyCard
                                    key={relatedJersey.id}
                                    id={relatedJersey.id}
                                    name={relatedJersey.name}
                                    player={relatedJersey.player}
                                    price={Number(relatedJersey.price)}
                                    originalPrice={relatedJersey.originalPrice ? Number(relatedJersey.originalPrice) : null}
                                    rating={relatedJersey.rating}
                                    reviews={relatedJersey.reviewCount}
                                    image={relatedJersey.image}
                                    badge={relatedJersey.badge}
                                    badgeColor={relatedJersey.badgeColor}
                                    index={index}
                                />
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </div>
    )
}

