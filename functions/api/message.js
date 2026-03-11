// Cloudflare Pages Function: message
// Handles "Leave a Message" form submissions
// ENV vars: GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_DRIVE_FOLDER_ID, NOTIFICATION_EMAIL, RESEND_API_KEY

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

  // Import the private key
  const pemContents = serviceAccount.private_key
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

  // Use multipart upload
  const boundary = 'msg_boundary_' + Date.now();
  const metadataPart = JSON.stringify(metadata);

  // Build multipart body
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

  // Convert file to base64
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

async function sendEmailNotification(apiKey, toEmail, senderName, senderEmail, messageText, messageType, driveLink) {
  const typeLabel = messageType.charAt(0).toUpperCase() + messageType.slice(1);
  const timestamp = new Date().toISOString();

  let mediaSection = '';
  if (driveLink) {
    mediaSection = `
      <tr>
        <td style="padding:8px 16px;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Attachment</td>
        <td style="padding:8px 16px;"><a href="${driveLink}" style="color:#5e2bff;">${typeLabel} file on Google Drive</a></td>
      </tr>`;
  }

  let messageSection = '';
  if (messageText) {
    messageSection = `
      <tr>
        <td colspan="2" style="padding:16px;border-top:1px solid #222;">
          <div style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Message</div>
          <div style="color:#fff;font-size:14px;line-height:1.6;white-space:pre-wrap;">${messageText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </td>
      </tr>`;
  }

  const html = `
    <div style="font-family:'DM Mono',monospace;background:#121212;color:#fff;padding:32px;">
      <div style="max-width:560px;margin:0 auto;background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:8px;overflow:hidden;">
        <div style="padding:16px;background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.06);">
          <span style="font-size:12px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.06em;">New ${typeLabel} Message</span>
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 16px;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;width:100px;">From</td>
            <td style="padding:8px 16px;color:#fff;font-size:14px;">${senderName.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
          </tr>
          <tr>
            <td style="padding:8px 16px;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Email</td>
            <td style="padding:8px 16px;"><a href="mailto:${senderEmail}" style="color:#5e2bff;">${senderEmail}</a></td>
          </tr>
          <tr>
            <td style="padding:8px 16px;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Type</td>
            <td style="padding:8px 16px;color:#fff;font-size:14px;">${typeLabel}</td>
          </tr>
          <tr>
            <td style="padding:8px 16px;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Time</td>
            <td style="padding:8px 16px;color:rgba(255,255,255,0.6);font-size:12px;">${timestamp}</td>
          </tr>
          ${mediaSection}
          ${messageSection}
        </table>
      </div>
    </div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Portfolio <noreply@khalildrissi.com>',
      to: [toEmail],
      subject: `New ${typeLabel} Message from ${senderName}`,
      html: html,
      reply_to: senderEmail,
    }),
  });

  const result = await res.json();
  if (!res.ok) {
    throw new Error('Resend email failed: ' + JSON.stringify(result));
  }
  return result;
}

// ---- Main handler ----

export async function onRequestPost(context) {
  const { env, request } = context;

  // Validate env
  if (!env.RESEND_API_KEY || !env.NOTIFICATION_EMAIL) {
    return jsonResponse({ error: 'Server not configured' }, 500);
  }

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
  const file = formData.get('file');

  if (!name || !email || !type) {
    return jsonResponse({ error: 'Missing required fields (name, email, type)' }, 400);
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: 'Invalid email address' }, 400);
  }

  // Validate type
  if (!['text', 'audio', 'video', 'file'].includes(type)) {
    return jsonResponse({ error: 'Invalid message type' }, 400);
  }

  // Text type requires a message
  if (type === 'text' && !message) {
    return jsonResponse({ error: 'Message is required for text type' }, 400);
  }

  // Audio, video, file types require a file
  if (['audio', 'video', 'file'].includes(type) && !file) {
    return jsonResponse({ error: 'File is required for this message type' }, 400);
  }

  // Check file size (25 MB)
  if (file && file.size > 25 * 1024 * 1024) {
    return jsonResponse({ error: 'File too large (max 25 MB)' }, 400);
  }

  let driveLink = null;

  // Upload file to Google Drive if present
  if (file && env.GOOGLE_SERVICE_ACCOUNT_JSON && env.GOOGLE_DRIVE_FOLDER_ID) {
    try {
      const serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
      const accessToken = await getAccessToken(serviceAccount);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${type}-${name.replace(/[^a-zA-Z0-9]/g, '_')}-${timestamp}-${file.name || 'recording'}`;
      const description = `From: ${name} <${email}>\nType: ${type}\nDate: ${new Date().toISOString()}\n${message ? 'Message: ' + message : ''}`;
      const fileData = await file.arrayBuffer();
      const result = await uploadToGoogleDrive(
        accessToken,
        env.GOOGLE_DRIVE_FOLDER_ID,
        fileName,
        fileData,
        file.type || 'application/octet-stream',
        description
      );
      driveLink = result.link;
    } catch (err) {
      console.error('Google Drive upload error:', err);
      // Continue without Drive upload — still send email
    }
  }

  // Send email notification
  try {
    await sendEmailNotification(
      env.RESEND_API_KEY,
      env.NOTIFICATION_EMAIL,
      name,
      email,
      message,
      type,
      driveLink
    );
  } catch (err) {
    console.error('Email notification error:', err);
    return jsonResponse({ error: 'Failed to send notification' }, 500);
  }

  return jsonResponse({ success: true });
}
