import type { MetadataRoute } from 'next';

const baseUrl = 'https://opussolutions.xyz';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${baseUrl}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/project-request`, changeFrequency: 'weekly', priority: 0.95 },
    { url: `${baseUrl}/bots`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/commands`, changeFrequency: 'monthly', priority: 0.55 },
    { url: `${baseUrl}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${baseUrl}/terms`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${baseUrl}/cancellation`, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
