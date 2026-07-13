"use client"

import { motion } from "framer-motion"
import { ArrowRight, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import Link from "next/link"

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-20">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/basketball-player-in-action-dramatic-lighting-dark.png"
          alt="Hero background"
          fill
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20"
            >
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm font-medium text-primary">2026 Design Collection</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-[var(--font-oswald)] text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight leading-[0.9]"
            >
              <span className="text-foreground">DESIGN YOUR</span>
              <br />
              <span className="text-primary">LEGACY</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-muted-foreground max-w-md leading-relaxed"
            >
              Premium jersey designs for all sports. Cricket, Football, Basketball, Volleyball & more. Create stunning
              designs for your team.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap items-center gap-4"
            >
              <Link href="/jerseys" passHref>
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 h-14 text-base font-semibold group"
                >
                  Browse Designs
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                className="border-border text-foreground hover:bg-accent hover:text-accent-foreground h-14 px-6 bg-transparent"
                onClick={() => window.open("https://www.youtube.com", "_blank")}
              >
                <Play className="mr-2 h-5 w-5 fill-current" />
                Watch Film
              </Button>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="grid grid-cols-3 gap-8 pt-8 border-t border-border"
            >
              {[
                { value: "50K+", label: "Designs Created" },
                { value: "200+", label: "Teams Served" },
                { value: "4.9★", label: "Customer Rating" },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="font-[var(--font-oswald)] text-2xl sm:text-3xl font-bold text-foreground">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right Content - Featured Jersey */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative hidden lg:block"
          >
            <div className="relative">
              {/* Glowing Effect */}
              <div className="absolute inset-0 blur-3xl bg-primary/20 rounded-full scale-75" />

              {/* Jersey Image */}
              <div className="relative aspect-[3/4] max-w-md mx-auto">
                <Image
                  src="/professional-basketball-jersey-floating-with-drama.png"
                  alt="Featured Jersey"
                  fill
                  className="object-contain drop-shadow-2xl"
                />
              </div>

              {/* Floating Badge */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="absolute top-10 -right-4 bg-card border border-border rounded-lg p-4 shadow-xl"
              >
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Limited Edition</div>
                <div className="font-[var(--font-oswald)] text-lg font-bold text-foreground">2026 All-Star</div>
              </motion.div>

              {/* Price Tag */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.7 }}
                className="absolute bottom-20 -left-4 bg-primary rounded-lg p-4 shadow-xl"
              >
                <div className="text-xs text-primary-foreground/80 uppercase tracking-wider">Starting at</div>
                <div className="font-[var(--font-oswald)] text-2xl font-bold text-primary-foreground">₹89</div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
          className="w-6 h-10 rounded-full border-2 border-muted-foreground flex items-start justify-center p-2"
        >
          <motion.div className="w-1 h-2 bg-muted-foreground rounded-full" />
        </motion.div>
      </motion.div>
    </section>
  )
}
