const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.cleanUpRoomWhenEmpty = functions.database
  .ref('/presence/{roomId}')
  .onWrite(async (change, context) => {
    const roomId = context.params.roomId;

    // Se il nodo non esiste più o è vuoto
    const presenceData = change.after.val();
    if (!presenceData || Object.keys(presenceData).length === 0) {
      // Cancella la stanza da Firestore
      await admin.firestore().collection('stanze').doc(roomId).delete().catch(() => {});
      console.log(`Stanza ${roomId} cancellata automaticamente (nessun partecipante online)`);
    }
    return null;
  });
