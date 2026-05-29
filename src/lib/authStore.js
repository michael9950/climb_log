import { getFirebaseAuthServices } from "./firebase";

export async function subscribeToAuthChanges(onUser, onError) {
  const services = await getFirebaseAuthServices();
  if (!services) return () => {};

  const { auth, onAuthStateChanged } = services;
  return onAuthStateChanged(auth, onUser, onError);
}

export async function createAccount({ displayName, email, password }) {
  const services = await getFirebaseAuthServices();
  if (!services) return null;

  const {
    auth,
    createUserWithEmailAndPassword,
    sendEmailVerification,
    signOut,
    updateProfile,
  } = services;
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    password,
  );
  const trimmedDisplayName = displayName.trim();

  if (trimmedDisplayName) {
    await updateProfile(credential.user, { displayName: trimmedDisplayName });
  }

  await sendEmailVerification(credential.user);
  await signOut(auth);

  return credential.user;
}

export async function signIn({ email, password }) {
  const services = await getFirebaseAuthServices();
  if (!services) return null;

  const {
    auth,
    reload,
    sendEmailVerification,
    signInWithEmailAndPassword,
    signOut,
  } = services;
  const credential = await signInWithEmailAndPassword(auth, email, password);
  await reload(credential.user);

  const user = auth.currentUser || credential.user;

  if (!user.emailVerified) {
    await sendEmailVerification(user);
    await signOut(auth);
    throw new Error("auth/email-not-verified");
  }

  return user;
}

export async function signOutAccount() {
  const services = await getFirebaseAuthServices();
  if (!services) return;

  await services.signOut(services.auth);
}

export async function updateDisplayName(displayName) {
  const services = await getFirebaseAuthServices();
  if (!services?.auth.currentUser) return null;

  const trimmedDisplayName = displayName.trim();
  await services.updateProfile(services.auth.currentUser, {
    displayName: trimmedDisplayName,
  });

  return {
    ...services.auth.currentUser,
    displayName: trimmedDisplayName,
  };
}

export async function deleteAccount(password) {
  const services = await getFirebaseAuthServices();
  const user = services?.auth.currentUser;

  if (!user?.email) {
    throw new Error("auth/no-current-user");
  }

  const credential = services.EmailAuthProvider.credential(
    user.email,
    password,
  );

  await services.reauthenticateWithCredential(user, credential);
  await services.deleteUser(user);
}

export function getFriendlyAuthError(error) {
  switch (error?.code || error?.message) {
    case "auth/configuration-not-found":
      return "Firebase Authentication 설정을 찾지 못했습니다. 콘솔에서 Authentication을 시작했는지 확인해주세요.";
    case "auth/email-already-in-use":
      return "이미 가입된 이메일입니다.";
    case "auth/invalid-email":
      return "이메일 형식을 확인해주세요.";
    case "auth/invalid-api-key":
      return "Firebase API Key가 올바르지 않습니다. .env.local 값을 확인해주세요.";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "이메일 또는 비밀번호가 맞지 않습니다.";
    case "auth/network-request-failed":
      return "Firebase에 연결하지 못했습니다. 인터넷 연결이나 Firebase 설정을 확인해주세요.";
    case "auth/operation-not-allowed":
      return "Firebase 콘솔에서 Email/Password 로그인을 Enable 해주세요.";
    case "auth/unauthorized-domain":
      return "Firebase Authentication의 Authorized domains에 현재 도메인을 추가해주세요.";
    case "auth/weak-password":
      return "비밀번호는 영문 대문자, 영문 소문자, 특수기호를 포함해 8자 이상으로 입력해주세요.";
    case "auth/email-not-verified":
      return "이메일 인증이 필요합니다. 받은 메일함을 확인해주세요. 인증 메일을 다시 보냈습니다.";
    case "auth/too-many-requests":
      return "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
    case "auth/requires-recent-login":
      return "보안을 위해 다시 로그인한 뒤 시도해주세요.";
    case "auth/no-current-user":
      return "현재 로그인된 계정을 찾지 못했습니다.";
    default:
      return `계정 작업을 완료하지 못했습니다. ${error?.code || error?.message || ""}`;
  }
}
