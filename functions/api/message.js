// Cloudflare Pages Function: message
// Handles "Leave a Message" form submissions
// ENV vars: GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_DRIVE_FOLDER_ID

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

// ---- JWT / Google Auth helpers ----

function base64urlEncode(data) {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function strToArrayBuffer(str) {
  return new TextEncoder().encode(str);
}

async function createJWT(serviceAccount) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const headerB64 = base64urlEncode(strToArrayBuffer(JSON.stringify(header)));
  const claimB64 = base64urlEncode(strToArrayBuffer(JSON.stringify(claim)));
  const unsignedToken = headerB64 + '.' + claimB64;

  // Handle escaped newlines from env vars (Cloudflare stores literal \n)
  let privateKey = serviceAccount.private_key;
  if (privateKey && !privateKey.includes('\n') && privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  const pemContents = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    strToArrayBuffer(unsignedToken)
  );

  return unsignedToken + '.' + base64urlEncode(signature);
}

async function getAccessToken(serviceAccount) {
  const jwt = await createJWT(serviceAccount);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error('Failed to get Google access token: ' + JSON.stringify(data));
  }
  return data.access_token;
}

async function uploadToGoogleDrive(accessToken, folderId, fileName, fileData, mimeType, description) {
  const metadata = {
    name: fileName,
    parents: [folderId],
    description: description,
  };

  const boundary = 'msg_boundary_' + Date.now();
  const metadataPart = JSON.stringify(metadata);

  const prefix = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadataPart,
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    'Content-Transfer-Encoding: base64',
    '',
    '',
  ].join('\r\n');

  const suffix = `\r\n--${boundary}--`;

  const fileBytes = new Uint8Array(fileData);
  let binary = '';
  for (let i = 0; i < fileBytes.length; i++) {
    binary += String.fromCharCode(fileBytes[i]);
  }
  const fileBase64 = btoa(binary);

  const body = prefix + fileBase64 + suffix;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: body,
    }
  );

  const result = await res.json();
  if (!result.id) {
    throw new Error('Google Drive upload failed: ' + JSON.stringify(result));
  }

  // Make the file accessible via link
  await fetch(`https://www.googleapis.com/drive/v3/files/${result.id}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });

  return {
    id: result.id,
    link: result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`,
  };
}

async function sendFormSubmitNotification(senderName, senderEmail, messageText, messageType, driveLinks) {
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

  if (driveLinks.length > 0) {
    payload['Attachments'] = driveLinks.map((l, i) => `File ${i + 1}: ${l}`).join('\n');
    payload['Note'] = `This submission includes ${driveLinks.length} file(s). Check your Google Drive or click the links above.`;
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

  const driveLinks = [];
  const uploadErrors = [];

  // Upload all files to Google Drive
  if (filesToUpload.length > 0 && env.GOOGLE_SERVICE_ACCOUNT_JSON && env.GOOGLE_DRIVE_FOLDER_ID) {
    try {
      // Handle potential escaped characters in the secret value
      let saJson = env.GOOGLE_SERVICE_ACCOUNT_JSON;
      // If it starts with a single quote or has escaped quotes, clean up
      saJson = saJson.trim().replace(/^'|'$/g, '');
      const serviceAccount = JSON.parse(saJson);
      const accessToken = await getAccessToken(serviceAccount);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      for (const f of filesToUpload) {
        try {
          const fileName = `${f.label}-${name.replace(/[^a-zA-Z0-9]/g, '_')}-${timestamp}-${f.blob.name || 'file'}`;
          const description = `From: ${name} <${email}>\nType: ${type}\nDate: ${new Date().toISOString()}\n${message ? 'Message: ' + message : ''}`;
          const fileData = await f.blob.arrayBuffer();
          const result = await uploadToGoogleDrive(
            accessToken,
            env.GOOGLE_DRIVE_FOLDER_ID,
            fileName,
            fileData,
            f.blob.type || 'application/octet-stream',
            description
          );
          driveLinks.push(result.link);
        } catch (err) {
          console.error('Drive upload error for', f.label, ':', err.message);
          uploadErrors.push(f.label);
        }
      }
    } catch (err) {
      console.error('Google auth error:', err.message);
      uploadErrors.push('auth: ' + err.message);
    }
  } else if (filesToUpload.length > 0) {
    // No Google Drive configured — note this in the email
    uploadErrors.push('drive-not-configured');
  }

  // Send notification via FormSubmit
  try {
    // If uploads failed, note it in the message
    let finalMessage = message;
    if (uploadErrors.length > 0 && filesToUpload.length > 0) {
      finalMessage += `\n\n[Note: ${filesToUpload.length} file(s) could not be uploaded to Google Drive. Error: ${uploadErrors.join(', ')}]`;
    }
    if (filesToUpload.length > 0 && driveLinks.length === 0) {
      finalMessage += `\n\n[${type} recording/files were attached but could not be saved. Please follow up with the sender.]`;
    }

    await sendFormSubmitNotification(name, email, finalMessage.trim(), type, driveLinks);
  } catch (err) {
    console.error('FormSubmit notification error:', err);
    return jsonResponse({ success: false, error: 'Failed to deliver message. Please email khalil@drissi.org directly.' }, 500);
  }

  const result = { success: true };
  if (driveLinks.length > 0) result.driveLinks = driveLinks;
  if (uploadErrors.length > 0) result.uploadErrors = uploadErrors;
  return jsonResponse(result);
}
