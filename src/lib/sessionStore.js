import { getFirebaseServices } from "./firebase";

const SESSIONS_COLLECTION = "sessions";

const getToday = () => {
  const now = new Date();
  const offsetDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
};

function normalizeFirestoreSession(documentSnapshot) {
  const data = documentSnapshot.data();

  return {
    id: documentSnapshot.id,
    date: data.date || getToday(),
    gym: data.gym || "",
    duration: Number(data.duration) || 0,
    grade: data.grade || "V0",
    condition: Number(data.condition) || 3,
    memo: data.memo || "",
    visibility: data.visibility === "public" ? "public" : "private",
    userId: data.userId || "",
    userEmail: data.userEmail || "",
    userName: data.userName || "",
    videoUrl: data.videoUrl || "",
    videoPath: data.videoPath || "",
    videoName: data.videoName || "",
    videoSize: Number(data.videoSize) || 0,
    videoContentType: data.videoContentType || "",
    createdAt: data.createdAt || new Date(0).toISOString(),
    updatedAt: data.updatedAt || "",
  };
}

export async function subscribeToFirebaseSessions(userId, onData, onError) {
  const services = await getFirebaseServices();
  if (!services) return () => {};

  const { db, collection, onSnapshot, query, where } = services;
  const userSessionsQuery = query(
    collection(db, SESSIONS_COLLECTION),
    where("userId", "==", userId),
  );

  return onSnapshot(
    userSessionsQuery,
    (snapshot) => {
      onData(snapshot.docs.map(normalizeFirestoreSession));
    },
    onError,
  );
}

export async function addFirebaseSession(session) {
  const services = await getFirebaseServices();
  if (!services) return;

  const { db, addDoc, collection } = services;
  await addDoc(collection(db, SESSIONS_COLLECTION), session);
}

export async function deleteFirebaseSession(id) {
  const services = await getFirebaseServices();
  if (!services) return;

  const { db, deleteDoc, doc } = services;
  await deleteDoc(doc(db, SESSIONS_COLLECTION, id));
}

export async function updateFirebaseSession(id, session) {
  const services = await getFirebaseServices();
  if (!services) return;

  const { db, doc, updateDoc } = services;
  await updateDoc(doc(db, SESSIONS_COLLECTION, id), session);
}

export async function deleteAllFirebaseSessions(userId) {
  const services = await getFirebaseServices();
  if (!services) return;

  const { db, collection, getDocs, query, where, writeBatch } = services;
  const userSessionsQuery = query(
    collection(db, SESSIONS_COLLECTION),
    where("userId", "==", userId),
  );
  const snapshot = await getDocs(userSessionsQuery);
  const batch = writeBatch(db);

  snapshot.docs.forEach((documentSnapshot) => {
    batch.delete(documentSnapshot.ref);
  });

  await batch.commit();
}

export async function updateFirebaseSessionUserName(userId, userName) {
  const services = await getFirebaseServices();
  if (!services) return;

  const { db, collection, getDocs, query, where, writeBatch } = services;
  const userSessionsQuery = query(
    collection(db, SESSIONS_COLLECTION),
    where("userId", "==", userId),
  );
  const snapshot = await getDocs(userSessionsQuery);

  if (snapshot.empty) return;

  const batch = writeBatch(db);

  snapshot.docs.forEach((documentSnapshot) => {
    batch.update(documentSnapshot.ref, { userName });
  });

  await batch.commit();
}
