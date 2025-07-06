import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

export const handleUserDisconnect = functions.database
  .ref('/presence/{roomId}/{userId}')
  .onDelete(async (snapshot: functions.database.DataSnapshot, context: functions.EventContext) => {
    const roomId = context.params.roomId;
    const userId = context.params.userId;

    const db = admin.firestore();
    const roomRef = db.doc(`stanze/${roomId}`);

    try {
      // Rimuove l'utente dalla lista partecipanti
      await roomRef.update({
        partecipanti: admin.firestore.FieldValue.arrayRemove(userId),
      });

      // Controlla se la stanza è ora vuota
      const roomSnap = await roomRef.get();
      const data = roomSnap.data();

      if (!data?.partecipanti || data.partecipanti.length === 0) {
        await roomRef.delete();
        console.log(`✅ Stanza ${roomId} eliminata automaticamente.`);
      }
    } catch (error) {
      console.error('❌ Errore nella gestione della disconnessione:', error);
    }
  });
