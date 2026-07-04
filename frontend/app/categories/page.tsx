"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { CategoryCard } from "@/components/category-card"
import { getCategories } from "@/lib/api"
import { Category } from "@/lib/types"
import { categoryColors } from "@/lib/category-colors"

export default function CategoriesPage() {
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getCategories()
            .then(setCategories)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

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
                        <span className="px-5">
                            ALL
                        </span>
                        <span className="font-[var(--font-oswald)] text-5xl sm:text-6xl lg:text-7xl  font-bold tracking-tight text-primary">
                            CATEGORIES
                        </span>

                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="text-muted-foreground mt-4 text-lg max-w-2xl mx-auto"
                    >
                        Explore our complete collection of authentic jerseys from all major sports leagues
                    </motion.p>
                </div>
            </section>

            {/* Categories Grid */}
            <section className="py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="font-[var(--font-oswald)] text-3xl font-bold text-foreground mb-8"
                    >
                        SHOP BY LEAGUE
                    </motion.h2>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                        {loading ? (
                            // Loading skeleton
                            Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="aspect-[3/4] bg-secondary/50 rounded-2xl animate-pulse" />
                            ))
                        ) : (
                            categories.map((category, index) => (
                                <CategoryCard
                                    key={category.id}
                                    id={category.id}
                                    name={category.name}
                                    image={category.image}
                                    description={category.description}
                                    count={`${category._count?.jerseys || 0}+ Designs`}
                                    color={categoryColors[category.id] || "from-gray-500/20"}
                                    index={index}
                                />
                            ))
                        )}
                    </div>
                </div>
            </section>
        </>
    )
}

