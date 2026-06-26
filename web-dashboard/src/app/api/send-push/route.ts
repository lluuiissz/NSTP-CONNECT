import { NextResponse } from 'next/server';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

// Extremely robust private key parsing
let formattedPrivateKey = process.env.FIREBASE_PRIVATE_KEY || '';
if (formattedPrivateKey) {
  formattedPrivateKey = formattedPrivateKey.trim();
  // If wrapped in quotes, try to JSON parse it to handle deep escapes
  if (formattedPrivateKey.startsWith('"') && formattedPrivateKey.endsWith('"')) {
    try {
      formattedPrivateKey = JSON.parse(formattedPrivateKey);
    } catch(e) {
      formattedPrivateKey = formattedPrivateKey.replace(/^"|"$/g, '');
    }
  }
  // Replace literal \n with actual newlines
  formattedPrivateKey = formattedPrivateKey.replace(/\\n/g, '\n');
  
  // Fix cases where copy-pasting turned newlines into spaces
  if (!formattedPrivateKey.includes('\n')) {
    formattedPrivateKey = formattedPrivateKey.replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n');
    formattedPrivateKey = formattedPrivateKey.replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----');
    // Replace all spaces in the base64 body with newlines
    const bodyMatch = formattedPrivateKey.match(/-----BEGIN PRIVATE KEY-----\n(.*?)\n-----END PRIVATE KEY-----/);
    if (bodyMatch && bodyMatch[1]) {
      const fixedBody = bodyMatch[1].replace(/ /g, '\n');
      formattedPrivateKey = `-----BEGIN PRIVATE KEY-----\n${fixedBody}\n-----END PRIVATE KEY-----`;
    }
  }
}

if (getApps().length === 0) {
  try {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: formattedPrivateKey,
      }),
    });
  } catch (error) {
    console.error('Firebase Admin Initialization Error:', error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, title, body: messageBody, data } = body;

    if (!token) {
      return NextResponse.json({ error: 'FCM token is required' }, { status: 400 });
    }

    // Define the message payload
    const message = {
      notification: {
        title,
        body: messageBody,
      },
      data: data || {},
      token,
    };

    // Send the push notification
    const response = await getMessaging().send(message);
    
    return NextResponse.json({ success: true, messageId: response });
  } catch (error: any) {
    console.error('Error sending push notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification', details: error.message },
      { status: 500 }
    );
  }
}
