import { fetchFile } from '../../../lib/telegram';

export const dynamic = 'force-dynamic';

const EXT_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

export async function GET(request) {
  const fileId = new URL(request.url).searchParams.get('f');
  if (!fileId) return new Response('Missing file id', { status: 400 });

  try {
    const { response, filePath } = await fetchFile(fileId);
    const ext = (filePath.split('.').pop() || '').toLowerCase();
    const bytes = Buffer.from(await response.arrayBuffer());
    return new Response(bytes, {
      headers: {
        'Content-Type': EXT_TYPES[ext] || 'application/octet-stream',
        'Content-Length': String(bytes.length),
        // file_ids are immutable, so the bytes can be cached aggressively
        'Cache-Control': 'public, max-age=604800, immutable',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
