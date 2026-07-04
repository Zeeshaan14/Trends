"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { motion } from "framer-motion"
import Image from "next/image"
import Link from "next/link"
import { Filter, Grid3X3, LayoutGrid, ArrowLeft, ArrowUpRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { JerseyCard } from "@/components/jersey-card"
import { getCategories, getJerseys } from "@/lib/api"
import { Category, Jersey } from "@/lib/types"
import { notFound } from "next/navigation"
import { categoryColors } from "@/lib/category-colors"

export default function CategoryPage() {
    const params = useParams()
    const categoryId = params.category as string
    const [gridSize, setGridSize] = useState<"small" | "large">("large")

    const [category, setCategory] = useState<Category | null>(null)
    const [categories, setCategories] = useState<Category[]>([])
    const [jerseys, setJerseys] = useState<Jersey[]>([])
    const [loading, setLoading] = useState(true)
    const [notFoundState, setNotFoundState] = useState(false)

    useEffect(() => {
        async function loadData() {
            try {
                const [categoriesData, jerseysData] = await Promise.all([
                    getCategories(),
                    getJerseys({ categoryId, limit: 50 }),
                ])

                const currentCategory = categoriesData.find((c) => c.id === categoryId)
                if (!currentCategory) {
                    setNotFoundState(true)
                    return
                }

                setCategories(categoriesData)
                setCategory(currentCategory)
                setJerseys(jerseysData.data)
            } catch (error) {
                console.error("Failed to load category data:", error)
                setNotFoundState(true)
            } finally {
                setLoading(false)
            }
        }

        loadData()
    }, [categoryId])

    if (notFoundState) {
        notFound()
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-background pt-32 pb-16 px-4">
                <div className="max-w-7xl mx-auto">
                    <div className="animate-pulse space-y-8">
                        <div className="h-16 bg-secondary/50 rounded-lg w-1/2" />
                        <div className="h-6 bg-secondary/50 rounded w-1/3" />
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} className="aspect-[3/4] bg-secondary/50 rounded-2xl" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (!category) return null

    return (
        <>
            {/* Hero Section */}
            <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-secondary/50 to-background">
                <div className="max-w-7xl mx-auto">
                    {/* Back Link */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        <Link
                            href="/categories"
                            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back to Categories
                        </Link>
                    </motion.div>

                    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                        <div>
                            <motion.h1
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6 }}
                                className="font-[var(--font-oswald)] text-5xl sm:text-6xl lg:text-7xl font-bold text-foreground tracking-tight"
                            >
                                {category.name.toUpperCase()} JERSEYS
                            </motion.h1>
                            <motion.p
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.1 }}
                                className="text-muted-foreground mt-4 text-lg max-w-2xl"
                            >
                                {category.description}
                            </motion.p>
                        </div>

                        {/* Category Image Preview */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="relative w-32 h-40 lg:w-40 lg:h-52 rounded-xl overflow-hidden hidden sm:block"
                        >
                            <Image
                                src={category.image || "/placeholder.svg"}
                                alt={category.name}
                                fill
                                className="object-cover"
                            />
                            <div className={`absolute inset-0 bg-gradient-to-t ${categoryColors[category.id] || "from-gray-500/20"} via-transparent to-transparent opacity-60`} />
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Other Categories */}
            <section className="py-8 px-4 sm:px-6 lg:px-8 border-b border-border">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center gap-4 overflow-x-auto pb-2">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">Browse:</span>
                        {categories.map((cat) => (
                            <Link
                                key={cat.id}
                                href={`/categories/${cat.id}`}
                                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${cat.id === categoryId
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-secondary text-foreground hover:bg-secondary/80"
                                    }`}
                            >
                                {cat.name}
                            </Link>
                        ))}
                        <Link
                            href="/categories"
                            className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap bg-transparent border border-border text-foreground hover:bg-secondary transition-colors"
                        >
                            View All
                        </Link>
                    </div>
                </div>
            </section>

            {/* Jerseys Grid Section */}
            <section className="py-12 px-4 sm:px-6 lg:px-8 bg-card">
                <div className="max-w-7xl mx-auto">
                    {/* Header with filters */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                        <p className="text-muted-foreground">
                            {jerseys.length} products
                        </p>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setGridSize("small")}
                                className={gridSize === "small" ? "bg-secondary" : ""}
                            >
                                <Grid3X3 className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setGridSize("large")}
                                className={gridSize === "large" ? "bg-secondary" : ""}
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" className="gap-2">
                                <Filter className="h-4 w-4" />
                                Filters
                            </Button>
                        </div>
                    </div>

                    {/* Products Grid */}
                    <motion.div
                        layout
                        className={`grid gap-4 sm:gap-6 ${gridSize === "large"
                            ? "grid-cols-2 lg:grid-cols-4"
                            : "grid-cols-3 lg:grid-cols-6"
                            }`}
                    >
                        {jerseys.map((jersey, index) => (
                            <JerseyCard
                                key={jersey.id}
                                id={jersey.id}
                                name={jersey.name}
                                player={jersey.player}
                                price={Number(jersey.price)}
                                originalPrice={jersey.originalPrice ? Number(jersey.originalPrice) : null}
                                rating={jersey.rating}
                                reviews={jersey.reviewCount}
                                image={jersey.image}
                                badge={jersey.badge}
                                badgeColor={jersey.badgeColor}
                                index={index}
                            />
                        ))}
                    </motion.div>

                    {/* Empty State */}
                    {jerseys.length === 0 && (
                        <div className="text-center py-16">
                            <p className="text-muted-foreground text-lg">No jerseys found in this category.</p>
                            <Link href="/categories">
                                <Button variant="outline" className="mt-4">
                                    Browse All Categories
                                </Button>
                            </Link>
                        </div>
                    )}

                    {/* Load More */}
                    {jerseys.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="flex justify-center mt-12"
                        >
                            <Button
                                variant="outline"
                                size="lg"
                                className="border-border text-foreground hover:bg-secondary group bg-transparent"
                            >
                                Load More Jerseys
                                <ArrowUpRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                            </Button>
                        </motion.div>
                    )}
                </div>
            </section>
        </>
    )
}

