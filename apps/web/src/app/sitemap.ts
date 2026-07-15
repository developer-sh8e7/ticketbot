import type { MetadataRoute } from 'next';

const baseUrl = 'https://opussolutions.xyz';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${baseUrl}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/project-request`, lastModified, changeFrequency: 'weekly', priority: 0.95 },
    { url: `${baseUrl}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${baseUrl}/terms`, lastModified, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${baseUrl}/cancellation`, lastModified, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
