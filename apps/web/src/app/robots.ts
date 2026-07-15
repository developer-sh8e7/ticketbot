import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/dashboard/', '/cart', '/login'],
    },
    sitemap: 'https://opussolutions.xyz/sitemap.xml',
    host: 'https://opussolutions.xyz',
  };
}
