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

async function sendFormSubmitNotification(senderName, senderEmail, messageText, messageType, fileLinks) {
  const typeLabel = messageType.charAt(0).toUpperCase() + messageType.slice(1);

  const payload = {
    _subject: `New ${typeLabel} Message from ${senderName}`,
    _replyto: senderEmail,
    _captcha: 'false',
    _template: 'table',
    Name: senderName,
    Email: senderEmail,
    Type: typeLabel,
    Message: messageText || '(no text message)',
  };

  if (fileLinks.length > 0) {
    payload['Attachments'] = fileLinks.map((l, i) => `File ${i + 1}: ${l}`).join('\n');
    payload['Note'] = `This submission includes ${fileLinks.length} file(s). Click the links above to view/download. Files expire after 90 days.`;
  }

  const res = await fetch('https://formsubmit.co/ajax/khalil@drissi.org', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Origin': 'https://khalildrissi.com',
      'Referer': 'https://khalildrissi.com/',
    },
    body: JSON.stringify(payload),
  });

  const result = await res.json();
  if (result.success === 'false' || result.success === false) {
    throw new Error('FormSubmit failed: ' + (result.message || JSON.stringify(result)));
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
  const file = formData.get('file'); // recording blob
  const attachments = formData.getAll('attachment'); // additional file attachments

  if (!name || !email || !type) {
    return jsonResponse({ error: 'Missing required fields (name, email, type)' }, 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: 'Invalid email address' }, 400);
  }

  if (!['text', 'audio', 'video', 'file'].includes(type)) {
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

  // Send notification via FormSubmit
  try {
    let finalMessage = message;
    if (uploadErrors.length > 0 && filesToUpload.length > 0) {
      finalMessage += `\n\n[Note: ${filesToUpload.length} file(s) could not be saved. Error: ${uploadErrors.join(', ')}]`;
    }
    if (filesToUpload.length > 0 && fileLinks.length === 0 && uploadErrors.length > 0) {
      finalMessage += `\n\n[${type} recording/files were attached but could not be saved. Please follow up with the sender.]`;
    }

    await sendFormSubmitNotification(name, email, finalMessage.trim(), type, fileLinks);
  } catch (err) {
    console.error('FormSubmit notification error:', err);
    return jsonResponse({ success: false, error: 'Failed to deliver message. Please email khalil@drissi.org directly.' }, 500);
  }

  const result = { success: true };
  if (fileLinks.length > 0) result.fileLinks = fileLinks;
  if (uploadErrors.length > 0) result.uploadErrors = uploadErrors;
  return jsonResponse(result);
}
