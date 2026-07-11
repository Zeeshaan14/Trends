"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Grid3X3, LayoutGrid, ChevronLeft, ChevronRight, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { JerseyCard } from "@/components/jersey-card"
import { getJerseys } from "@/lib/api"
import { Jersey } from "@/lib/types"

export default function JerseysPage() {
    const [jerseys, setJerseys] = useState<Jersey[]>([])
    const [loading, setLoading] = useState(true)
    const [gridSize, setGridSize] = useState<"small" | "large">("large")
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [searchQuery, setSearchQuery] = useState("")
    const limit = 20

    useEffect(() => {
        setLoading(true)
        const delayDebounceFn = setTimeout(() => {
            getJerseys({
                page: currentPage,
                limit,
                search: searchQuery,
            })
                .then((response) => {
                    setJerseys(response.data)
                    setTotalPages(response.pagination?.totalPages || 1)
                })
                .catch(console.error)
                .finally(() => setLoading(false))
        }, 300)

        return () => clearTimeout(delayDebounceFn)
    }, [currentPage, searchQuery])

    return (
        <>
            {/* Hero Section */}
            <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-secondary/50 to-background">
                <div className="max-w-7xl mx-auto text-center">
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="font-[var(--font-oswald)] text-5xl sm:text-6xl lg:text-7xl font-bold text-foreground tracking-tight"
                    >
                        <span className="px-5">ALL</span>
                        <span className="font-[var(--font-oswald)] text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-primary">
                            JERSEYS
                        </span>
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="text-muted-foreground mt-4 text-lg max-w-2xl mx-auto"
                    >
                        Browse our complete collection of premium jersey designs
                    </motion.p>
                </div>
            </section>

            {/* Jerseys Grid Section */}
            <section className="py-12 px-4 sm:px-6 lg:px-8 bg-card">
                <div className="max-w-7xl mx-auto">
                    {/* Header with filters */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                            <p className="text-muted-foreground whitespace-nowrap">
                                {loading ? "Loading..." : `${jerseys.length} products`}
                            </p>
                            <div className="relative flex-1 sm:flex-none">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Search jerseys..."
                                    className="pl-8 w-full sm:w-[300px]"
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value)
                                        setCurrentPage(1)
                                    }}
                                />
                            </div>
                        </div>

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
                        {loading ? (
                            // Loading skeleton
                            Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} className="aspect-[3/4] bg-secondary/50 rounded-2xl animate-pulse" />
                            ))
                        ) : (
                            <AnimatePresence mode="popLayout">
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
                            </AnimatePresence>
                        )}
                    </motion.div>

                    {/* Empty State */}
                    {!loading && jerseys.length === 0 && (
                        <div className="text-center py-16">
                            <p className="text-muted-foreground text-lg">No jerseys found.</p>
                        </div>
                    )}

                    {/* Pagination */}
                    {!loading && totalPages > 1 && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="flex justify-center items-center gap-4 mt-12"
                        >
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className="border-border text-foreground"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <span className="text-muted-foreground">
                                Page {currentPage} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage === totalPages}
                                className="border-border text-foreground"
                            >
                                <ChevronRight className="h-5 w-5" />
                            </Button>
                        </motion.div>
                    )}
                </div>
            </section>
        </>
    )
}
