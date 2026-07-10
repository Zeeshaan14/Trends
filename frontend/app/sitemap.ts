import { MetadataRoute } from 'next'
import { getJerseys } from '@/lib/api'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://nujerseys.com'
  
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date() },
    { url: `${baseUrl}/categories`, lastModified: new Date() },
    { url: `${baseUrl}/terms`, lastModified: new Date() },
    { url: `${baseUrl}/privacy-policy`, lastModified: new Date() },
  ]
  
  try {
    const jerseys = await getJerseys({ limit: 100 }).then(res => res.data).catch(() => [])
    
    const jerseyRoutes = jerseys.map((j) => ({
      url: `${baseUrl}/jerseys/${j.id}`,
      lastModified: new Date(),
    }))
    
    return [...staticRoutes, ...jerseyRoutes]
  } catch (e) {
    return staticRoutes
  }
}
