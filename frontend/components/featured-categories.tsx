"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { CategoryCard } from "@/components/category-card"
import { getCategories } from "@/lib/api"
import { Category } from "@/lib/types"
import { categoryColors } from "@/lib/category-colors"

export function FeaturedCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12"
        >
          <div>
            <h2 className="font-[var(--font-oswald)] text-4xl sm:text-5xl font-bold text-foreground tracking-tight">
              SHOP BY LEAGUE
            </h2>
            <p className="text-muted-foreground mt-2">Find your team, rep your colors</p>
          </div>
          <Link
            href="/categories"
            className="text-sm font-medium text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1 group"
          >
            View All Categories
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </motion.div>

        {/* Categories Grid */}
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
  )
}

