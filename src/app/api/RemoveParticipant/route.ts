import { db } from '@/lib/firebaseConfig';
import { doc, updateDoc, arrayRemove } from 'firebase/firestore';

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get('roomId');
  const username = searchParams.get('username');

  if (!roomId || !username) {
    return new Response('Missing data', { status: 400 });
  }

  try {
    await updateDoc(doc(db, 'stanze', roomId), {
      partecipanti: arrayRemove(username),
    });
    return new Response('Removed', { status: 200 });
  } catch {
    return new Response('Failed', { status: 500 });
  }
}
