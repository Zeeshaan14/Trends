"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Search, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Navbar,
  NavBody,
  NavItems,
  MobileNav,
  MobileNavHeader,
  MobileNavMenu,
  MobileNavToggle,
  NavbarButton,
} from "@/components/ui/resizable-navbar"
import { CartSheet } from "@/components/cart-sheet"

const navLinks = [
  { name: "Categories", link: "/categories" },
  { name: "Cricket", link: "/categories/cricket" },
  { name: "Football", link: "/categories/football" },
  { name: "Basketball", link: "/categories/basketball" },
  { name: "Volleyball", link: "/categories/volleyball" },
]

export function SiteNavbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  if (pathname?.startsWith("/admin")) {
    return null
  }

  return (
    <Navbar>
      {/* Desktop Navigation */}
      <NavBody className="bg-background/80 dark:bg-background/80">
        {/* Logo */}
        <Link href="/" className="relative z-20 flex items-center">
          <div 
            className="h-10 w-[150px] bg-gradient-to-r from-primary to-foreground"
            style={{
              WebkitMaskImage: 'url(/nu3.png)',
              WebkitMaskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              WebkitMaskPosition: 'left center',
              maskImage: 'url(/nu3.png)',
              maskSize: 'contain',
              maskRepeat: 'no-repeat',
              maskPosition: 'left center',
            }}
          />
        </Link>

        {/* Nav Items */}
        <NavItems items={navLinks} />

        {/* Right Actions */}
        <div className="relative z-20 flex items-center gap-2">
          
          
          <CartSheet />
          <NavbarButton variant="gradient" className="hidden sm:inline-block">
            Shop Now
          </NavbarButton>
        </div>
      </NavBody>

      {/* Mobile Navigation */}
      <MobileNav className="bg-background/80 dark:bg-background/80">
        <MobileNavHeader>
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <div 
              className="h-8 w-[120px] bg-gradient-to-r from-primary to-foreground"
              style={{
                WebkitMaskImage: 'url(/nu3.png)',
                WebkitMaskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                WebkitMaskPosition: 'left center',
                maskImage: 'url(/nu3.png)',
                maskSize: 'contain',
                maskRepeat: 'no-repeat',
                maskPosition: 'left center',
              }}
            />
          </Link>

          {/* Right side icons and toggle */}
          <div className="flex items-center gap-2">
            <CartSheet />
            <MobileNavToggle
              isOpen={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            />
          </div>
        </MobileNavHeader>

        <MobileNavMenu
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        >
          {navLinks.map((link, idx) => (
            <Link
              key={`mobile-link-${idx}`}
              href={link.link}
              className="w-full text-lg font-medium text-foreground hover:text-primary transition-colors py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {link.name}
            </Link>
          ))}
          <div className="flex items-center gap-4 py-2 text-foreground">
            <Button variant="ghost" className="justify-start px-0 hover:bg-transparent w-full">
              <Search className="h-5 w-5 mr-2" />
              Search
            </Button>
          </div>
          <div className="flex items-center gap-4 py-2 text-foreground">
            <Button variant="ghost" className="justify-start px-0 hover:bg-transparent w-full">
              <User className="h-5 w-5 mr-2" />
              Account
            </Button>
          </div>
          <div className="flex w-full flex-col gap-4 pt-4">
            <NavbarButton
              variant="gradient"
              className="w-full"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Shop Now
            </NavbarButton>
          </div>
        </MobileNavMenu>
      </MobileNav>
    </Navbar >
  )
}
