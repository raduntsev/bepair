import 'server-only';
import { createSign, sign as signRaw, createPrivateKey } from 'node:crypto';
import http2 from 'node:http2';

/*
  Native push for the iOS/Android app, without extra dependencies.
  Android goes through FCM HTTP v1 (service-account JWT → OAuth token);
  iOS goes straight to APNs over HTTP/2 with a .p8 key (ES256 JWT).
  Each sender returns 'ok', 'dead' (the device token is gone — delete it)
  or 'failed' (try again next time).
*/

export type SendResult = 'ok' | 'dead' | 'failed';

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag: string;
  silent: boolean;
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString('base64url');

/* ── FCM ─────────────────────────────────────────────────────────────────── */

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
}

let fcmCache: { token: string; expires: number } | null = null;

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
    return parsed.project_id && parsed.client_email && parsed.private_key ? parsed : null;
  } catch {
    return null;
  }
}

async function fcmAccessToken(account: ServiceAccount) {
  if (fcmCache && fcmCache.expires > Date.now() + 60_000) return fcmCache.token;
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = account.token_uri ?? 'https://oauth2.googleapis.com/token';
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(
    JSON.stringify({
      iss: account.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    }),
  )}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  const assertion = `${unsigned}.${b64url(signer.sign(account.private_key))}`;

  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!response.ok) throw new Error(`fcm oauth ${response.status}`);
  const json = (await response.json()) as { access_token: string; expires_in: number };
  fcmCache = { token: json.access_token, expires: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

export const fcmConfigured = () => serviceAccount() !== null;

export async function sendFcm(deviceToken: string, message: PushMessage): Promise<SendResult> {
  const account = serviceAccount();
  if (!account) return 'failed';
  try {
    const access = await fcmAccessToken(account);
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token: deviceToken,
          notification: { title: message.title, body: message.body },
          data: { url: message.url },
          android: {
            priority: 'high',
            notification: {
              tag: message.tag,
              channel_id: message.silent ? 'quiet' : 'default',
            },
          },
        },
      }),
    });
    if (response.ok) return 'ok';
    const text = await response.text();
    if (response.status === 404 || text.includes('UNREGISTERED') || text.includes('INVALID_ARGUMENT')) return 'dead';
    return 'failed';
  } catch {
    return 'failed';
  }
}

/* ── APNs ────────────────────────────────────────────────────────────────── */

let apnsCache: { jwt: string; issued: number } | null = null;

function apnsConfig() {
  const key = process.env.APNS_KEY;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const topic = process.env.APNS_BUNDLE_ID;
  if (!key || !keyId || !teamId || !topic) return null;
  const pem = key.includes('BEGIN PRIVATE KEY') ? key.replace(/\\n/g, '\n') : Buffer.from(key, 'base64').toString('utf8');
  return { pem, keyId, teamId, topic, production: process.env.APNS_PRODUCTION === '1' };
}

export const apnsConfigured = () => apnsConfig() !== null;

function apnsJwt(config: NonNullable<ReturnType<typeof apnsConfig>>) {
  /* Apple rejects tokens older than an hour and throttles fresh ones: reuse for 50 minutes. */
  if (apnsCache && Date.now() - apnsCache.issued < 50 * 60 * 1000) return apnsCache.jwt;
  const unsigned = `${b64url(JSON.stringify({ alg: 'ES256', kid: config.keyId }))}.${b64url(
    JSON.stringify({ iss: config.teamId, iat: Math.floor(Date.now() / 1000) }),
  )}`;
  const signature = signRaw('sha256', Buffer.from(unsigned), {
    key: createPrivateKey(config.pem),
    dsaEncoding: 'ieee-p1363',
  });
  const jwt = `${unsigned}.${b64url(signature)}`;
  apnsCache = { jwt, issued: Date.now() };
  return jwt;
}

export async function sendApns(deviceToken: string, message: PushMessage): Promise<SendResult> {
  const config = apnsConfig();
  if (!config) return 'failed';
  const host = config.production ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com';

  return new Promise<SendResult>((resolve) => {
    let settled = false;
    const done = (result: SendResult) => {
      if (settled) return;
      settled = true;
      client.close();
      resolve(result);
    };
    const client = http2.connect(host);
    client.on('error', () => done('failed'));

    let jwt: string;
    try {
      jwt = apnsJwt(config);
    } catch {
      done('failed');
      return;
    }

    const request = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      authorization: `bearer ${jwt}`,
      'apns-topic': config.topic,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-collapse-id': message.tag.slice(0, 64),
      'content-type': 'application/json',
    });

    let status = 0;
    let body = '';
    request.on('response', (headers) => {
      status = Number(headers[':status']);
    });
    request.setEncoding('utf8');
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      if (status === 200) done('ok');
      else if (status === 410 || body.includes('BadDeviceToken') || body.includes('Unregistered')) done('dead');
      else done('failed');
    });
    request.on('error', () => done('failed'));
    request.setTimeout(10_000, () => {
      request.close();
      done('failed');
    });

    request.end(
      JSON.stringify({
        aps: {
          alert: { title: message.title, body: message.body },
          ...(message.silent ? {} : { sound: 'default' }),
          'thread-id': 'vpare',
        },
        url: message.url,
      }),
    );
  });
}
