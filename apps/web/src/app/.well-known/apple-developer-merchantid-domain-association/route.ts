export const runtime = 'nodejs';

import fs from 'node:fs/promises';
import path from 'node:path';

async function readAssociationFromPublicFile() {
  try {
    const filePath = path.join(process.cwd(), 'public', '.well-known', 'apple-developer-merchantid-domain-association');
    return (await fs.readFile(filePath, 'utf8')).trim();
  } catch {
    return '';
  }
}

export async function GET() {
  const association = process.env.PAYPAL_APPLE_PAY_DOMAIN_ASSOCIATION?.trim() || await readAssociationFromPublicFile();
  if (!association) {
    return new Response('Apple Pay domain association file is not configured.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  return new Response(association, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
