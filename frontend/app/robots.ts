import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"
  const isProd = process.env.NODE_ENV === "production"
  
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/admin/:path*', '/checkout/'],
    },
    sitemap: 'https://nujerseys.com/sitemap.xml',
  }
}
