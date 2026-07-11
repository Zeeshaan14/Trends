"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { JerseyCard } from "@/components/jersey-card"
import { getJerseys } from "@/lib/api"
import { Jersey } from "@/lib/types"

export function TrendingJerseys() {
  const [jerseys, setJerseys] = useState<Jersey[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(0)
  const itemsPerPage = 4
  const totalPages = Math.ceil(jerseys.length / itemsPerPage)

  useEffect(() => {
    getJerseys({ limit: 20 })
      .then((response) => setJerseys(response.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const displayedJerseys = jerseys.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage)

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-card">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12"
        >
          <div>
            <h2 className="font-[var(--font-oswald)] text-4xl sm:text-5xl font-bold text-foreground tracking-tight">
              TRENDING NOW
            </h2>
            <p className="text-muted-foreground mt-2">Hot picks from this season</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0 || loading}
              className="border-border text-foreground"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage === totalPages - 1 || loading}
              className="border-border text-foreground"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </motion.div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {loading ? (
            // Loading skeleton
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-secondary/50 rounded-2xl animate-pulse" />
            ))
          ) : (
            <AnimatePresence mode="popLayout">
              {displayedJerseys.map((jersey, index) => (
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
        </div>

        {/* View All Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex justify-center mt-12"
        >
          <Link href="/jerseys">
            <Button
              variant="outline"
              size="lg"
              className="border-border text-foreground hover:bg-accent hover:text-accent-foreground group bg-transparent"
            >
              View All Jerseys
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  )
}

