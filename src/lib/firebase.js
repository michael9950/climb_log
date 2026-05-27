const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const requiredConfigKeys = ["apiKey", "authDomain", "projectId", "appId"];
const isVideoUploadEnabled =
  import.meta.env.VITE_ENABLE_VIDEO_UPLOAD === "true";

export const hasFirebaseConfig = requiredConfigKeys.every(
  (key) => Boolean(firebaseConfig[key]),
);

export const hasFirebaseStorageConfig =
  isVideoUploadEnabled &&
  hasFirebaseConfig &&
  Boolean(firebaseConfig.storageBucket);

let firebaseServicesPromise;

export function getFirebaseServices() {
  if (!hasFirebaseConfig) return Promise.resolve(null);

  if (!firebaseServicesPromise) {
    firebaseServicesPromise = Promise.all([
      import("firebase/app"),
      import("firebase/firestore"),
    ]).then(([appModule, firestoreModule]) => {
      const app = appModule.getApps().length
        ? appModule.getApp()
        : appModule.initializeApp(firebaseConfig);
      const db = firestoreModule.getFirestore(app);

      return {
        app,
        db,
        addDoc: firestoreModule.addDoc,
        collection: firestoreModule.collection,
        deleteDoc: firestoreModule.deleteDoc,
        doc: firestoreModule.doc,
        getDocs: firestoreModule.getDocs,
        onSnapshot: firestoreModule.onSnapshot,
        query: firestoreModule.query,
        updateDoc: firestoreModule.updateDoc,
        where: firestoreModule.where,
        writeBatch: firestoreModule.writeBatch,
      };
    });
  }

  return firebaseServicesPromise;
}

let firebaseAuthServicesPromise;

export function getFirebaseAuthServices() {
  if (!hasFirebaseConfig) return Promise.resolve(null);

  if (!firebaseAuthServicesPromise) {
    firebaseAuthServicesPromise = Promise.all([
      getFirebaseServices(),
      import("firebase/auth"),
    ]).then(([services, authModule]) => {
      const auth = authModule.getAuth(services.app);

      return {
        auth,
        createUserWithEmailAndPassword:
          authModule.createUserWithEmailAndPassword,
        deleteUser: authModule.deleteUser,
        EmailAuthProvider: authModule.EmailAuthProvider,
        onAuthStateChanged: authModule.onAuthStateChanged,
        reauthenticateWithCredential: authModule.reauthenticateWithCredential,
        signInWithEmailAndPassword: authModule.signInWithEmailAndPassword,
        signOut: authModule.signOut,
        updateProfile: authModule.updateProfile,
      };
    });
  }

  return firebaseAuthServicesPromise;
}

let firebaseStorageServicesPromise;

export function getFirebaseStorageServices() {
  if (!hasFirebaseStorageConfig) return Promise.resolve(null);

  if (!firebaseStorageServicesPromise) {
    firebaseStorageServicesPromise = Promise.all([
      getFirebaseServices(),
      import("firebase/storage"),
    ]).then(([services, storageModule]) => {
      const storage = storageModule.getStorage(services.app);

      return {
        storage,
        deleteObject: storageModule.deleteObject,
        getDownloadURL: storageModule.getDownloadURL,
        ref: storageModule.ref,
        uploadBytesResumable: storageModule.uploadBytesResumable,
      };
    });
  }

  return firebaseStorageServicesPromise;
}
