import { NextResponse } from 'next/server';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

// Format private key safely (handles Vercel escaping and surrounding quotes)
let formattedPrivateKey = process.env.FIREBASE_PRIVATE_KEY || '';
formattedPrivateKey = formattedPrivateKey.replace(/^"|"$|^'|'$/g, ''); // Remove wrapping quotes if added
formattedPrivateKey = formattedPrivateKey.replace(/\\n/g, '\n');       // Fix escaped newlines

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
