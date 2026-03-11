// Serves files stored in KV (MESSAGE_FILES namespace)
// GET /api/file/:id

export async function onRequestGet(context) {
  const { env, params } = context;
  const id = params.id;

  if (!id || !env.MESSAGE_FILES) {
    return new Response('Not found', { status: 404 });
  }

  // Get metadata
  const { value, metadata } = await env.MESSAGE_FILES.getWithMetadata(id, { type: 'arrayBuffer' });

  if (!value) {
    return new Response('File not found', { status: 404 });
  }

  const mimeType = (metadata && metadata.mimeType) || 'application/octet-stream';
  const fileName = (metadata && metadata.fileName) || 'file';

  return new Response(value, {
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Cache-Control': 'public, max-age=31536000',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
