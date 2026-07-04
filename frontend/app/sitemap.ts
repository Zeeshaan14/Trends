import { MetadataRoute } from 'next'
import { getCategories, getJerseys } from '@/lib/api'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://nujerseys.com'
  
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date() },
    { url: `${baseUrl}/categories`, lastModified: new Date() },
    { url: `${baseUrl}/terms`, lastModified: new Date() },
    { url: `${baseUrl}/privacy-policy`, lastModified: new Date() },
  ]
  
  try {
    const [categories, jerseys] = await Promise.all([
      getCategories().catch(() => []),
      getJerseys({ limit: 100 }).then(res => res.data).catch(() => []),
    ])
    
    const categoryRoutes = categories.map((cat) => ({
      url: `${baseUrl}/categories/${cat.id}`,
      lastModified: new Date(),
    }))
    
    const jerseyRoutes = jerseys.map((j) => ({
      url: `${baseUrl}/jerseys/${j.id}`,
      lastModified: new Date(),
    }))
    
    return [...staticRoutes, ...categoryRoutes, ...jerseyRoutes]
  } catch (e) {
    return staticRoutes
  }
}
