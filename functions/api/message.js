// Cloudflare Pages Function: message
// Handles "Leave a Message" form submissions
// KV binding: MESSAGE_FILES (for file storage)

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}

// CORS preflight
export async function onRequestOptions() {
  return jsonResponse({});
}

// Generate a random ID for file storage
function generateId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  for (const b of bytes) id += chars[b % chars.length];
  return id;
}

// Upload file to Cloudflare KV
async function uploadToKV(kvNamespace, fileName, fileData, mimeType, siteUrl) {
  const id = generateId();
  await kvNamespace.put(id, fileData, {
    metadata: { fileName, mimeType },
    // Files expire after 90 days
    expirationTtl: 90 * 24 * 60 * 60,
  });
  return {
    id,
    link: `${siteUrl}/api/file/${id}`,
  };
}

// Submit to Contact Form 7 on the WordPress CMS (public feedback endpoint — no auth needed).
const CF7_BASE = 'https://cms.drissi.xyz';
const CF7_FORM_ID = '338';

async function submitToCF7({ name, email, type, message, company, date }, fileLinks) {
  let body = message || '';
  if (fileLinks && fileLinks.length > 0) {
    body += `\n\nAttachments (links expire in 90 days):\n` + fileLinks.map((l, i) => `${i + 1}. ${l}`).join('\n');
  }

  const fd = new FormData();
  fd.append('_wpcf7', CF7_FORM_ID);
  fd.append('_wpcf7_version', '6.0');
  fd.append('_wpcf7_locale', 'en_US');
  fd.append('_wpcf7_unit_tag', `wpcf7-f${CF7_FORM_ID}-o1`);
  fd.append('_wpcf7_container_post', '0');
  fd.append('your-name', name);
  fd.append('your-email', email);
  fd.append('submission-type', type);
  fd.append('company', company || '');
  fd.append('preferred-date', date || '');
  fd.append('preferred-time', '');
  fd.append('topic', '');
  fd.append('your-message', body.trim() || '(no message)');

  const res = await fetch(`${CF7_BASE}/wp-json/contact-form-7/v1/contact-forms/${CF7_FORM_ID}/feedback`, {
    method: 'POST',
    body: fd,
  });
  const result = await res.json().catch(() => ({}));
  // 'mail_sent' = email delivered; 'mail_failed' = email didn't send but CF7 accepted it
  // and Flamingo has stored the submission in WP admin, so it's still captured (not lost).
  if (result.status !== 'mail_sent' && result.status !== 'mail_failed') {
    throw new Error('CF7: ' + (result.message || result.status || `HTTP ${res.status}`));
  }
  return result;
}

// ---- Main handler ----

export async function onRequestPost(context) {
  const { env, request } = context;

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ error: 'Invalid form data' }, 400);
  }

  const name = formData.get('name');
  const email = formData.get('email');
  const type = formData.get('type');
  const message = formData.get('message') || '';
  const company = formData.get('company') || '';
  const date = formData.get('date') || '';
  const file = formData.get('file'); // recording blob
  const attachments = formData.getAll('attachment'); // additional file attachments

  if (!name || !email || !type) {
    return jsonResponse({ error: 'Missing required fields (name, email, type)' }, 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: 'Invalid email address' }, 400);
  }

  if (!['text', 'audio', 'video', 'file', 'schedule', 'collaboration'].includes(type)) {
    return jsonResponse({ error: 'Invalid message type' }, 400);
  }

  if (type === 'text' && !message && attachments.length === 0) {
    return jsonResponse({ error: 'Message is required for text type' }, 400);
  }

  if (['audio', 'video'].includes(type) && !file) {
    return jsonResponse({ error: 'Recording is required for this message type' }, 400);
  }

  // Collect all files to upload (recording + attachments)
  const filesToUpload = [];
  if (file) {
    if (file.size > 25 * 1024 * 1024) {
      return jsonResponse({ error: 'File too large (max 25 MB)' }, 400);
    }
    filesToUpload.push({ blob: file, label: type + '-recording' });
  }
  for (const att of attachments) {
    if (att && att.size) {
      if (att.size > 25 * 1024 * 1024) continue; // skip oversized
      filesToUpload.push({ blob: att, label: 'attachment' });
    }
  }

  const fileLinks = [];
  const uploadErrors = [];

  // Determine site URL for file links
  const url = new URL(request.url);
  const siteUrl = url.origin;

  // Upload files to Cloudflare KV
  if (filesToUpload.length > 0 && env.MESSAGE_FILES) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    for (const f of filesToUpload) {
      try {
        const fileName = `${f.label}-${name.replace(/[^a-zA-Z0-9]/g, '_')}-${timestamp}-${f.blob.name || 'file'}`;
        const fileData = await f.blob.arrayBuffer();
        const result = await uploadToKV(
          env.MESSAGE_FILES,
          fileName,
          fileData,
          f.blob.type || 'application/octet-stream',
          siteUrl
        );
        fileLinks.push(result.link);
      } catch (err) {
        console.error('KV upload error for', f.label, ':', err.message);
        uploadErrors.push(f.label + ': ' + err.message);
      }
    }
  } else if (filesToUpload.length > 0) {
    uploadErrors.push('storage-not-configured');
  }

  // Deliver via Contact Form 7 on the WordPress CMS
  try {
    let finalMessage = message;
    if (uploadErrors.length > 0 && filesToUpload.length > 0) {
      finalMessage += `\n\n[Note: ${filesToUpload.length} file(s) could not be saved. Error: ${uploadErrors.join(', ')}]`;
    }

    await submitToCF7({ name, email, type, message: finalMessage, company, date }, fileLinks);
  } catch (err) {
    console.error('CF7 submission error:', err);
    return jsonResponse({ success: false, error: 'Failed to send. Please email khalil@drissi.org directly.', detail: err.message }, 500);
  }

  const result = { success: true };
  if (fileLinks.length > 0) result.fileLinks = fileLinks;
  if (uploadErrors.length > 0) result.uploadErrors = uploadErrors;
  return jsonResponse(result);
}
