import { getFirebaseStorageServices } from "./firebase";

const VIDEO_FOLDER = "session-videos";
const FIRST_PROGRESS_TIMEOUT_MS = 45_000;
const TOTAL_UPLOAD_TIMEOUT_MS = 5 * 60_000;

function sanitizeFileName(fileName) {
  return fileName
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 80);
}

export async function uploadFirebaseVideo(userId, file, onProgress) {
  const services = await getFirebaseStorageServices();

  if (!services) {
    throw new Error("storage/not-configured");
  }

  const safeName = sanitizeFileName(file.name) || "climb-video";
  const path = `${VIDEO_FOLDER}/${userId}/${Date.now()}-${safeName}`;
  const storageRef = services.ref(services.storage, path);
  const uploadTask = services.uploadBytesResumable(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      userId,
    },
  });

  onProgress?.(0);

  await new Promise((resolve, reject) => {
    let lastBytesTransferred = 0;
    let lastProgressAt = Date.now();
    let isFinished = false;

    const cleanup = () => {
      isFinished = true;
      window.clearInterval(stallTimer);
      window.clearTimeout(totalTimer);
    };

    const rejectWithCancel = (error) => {
      if (isFinished) return;

      cleanup();
      uploadTask.cancel();
      reject(error);
    };

    const stallTimer = window.setInterval(() => {
      if (Date.now() - lastProgressAt >= FIRST_PROGRESS_TIMEOUT_MS) {
        rejectWithCancel(new Error("storage/upload-stalled"));
      }
    }, 5_000);

    const totalTimer = window.setTimeout(() => {
      rejectWithCancel(new Error("storage/upload-timeout"));
    }, TOTAL_UPLOAD_TIMEOUT_MS);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
        );

        if (snapshot.bytesTransferred > lastBytesTransferred) {
          lastBytesTransferred = snapshot.bytesTransferred;
          lastProgressAt = Date.now();
        }

        onProgress?.(progress);
      },
      (error) => {
        cleanup();
        reject(error);
      },
      () => {
        cleanup();
        resolve();
      },
    );
  });

  const url = await services.getDownloadURL(uploadTask.snapshot.ref);

  return {
    videoUrl: url,
    videoPath: path,
    videoName: file.name,
    videoSize: file.size,
    videoContentType: file.type,
  };
}

export async function deleteFirebaseVideo(path) {
  if (!path) return;

  const services = await getFirebaseStorageServices();
  if (!services) return;

  try {
    await services.deleteObject(services.ref(services.storage, path));
  } catch (error) {
    if (error?.code !== "storage/object-not-found") {
      throw error;
    }
  }
}

export function getFriendlyVideoError(error) {
  switch (error?.code || error?.message) {
    case "storage/not-configured":
      return "Firebase Storage 설정을 찾지 못했습니다. .env.local의 storageBucket 값을 확인해주세요.";
    case "storage/unauthorized":
      return "Firebase Storage 권한이 없습니다. Storage Rules가 로그인한 사용자의 업로드를 허용하는지 확인해주세요.";
    case "storage/canceled":
      return "동영상 업로드가 취소되었습니다.";
    case "storage/quota-exceeded":
      return "Firebase Storage 사용량 한도를 초과했습니다.";
    case "storage/retry-limit-exceeded":
      return "Firebase Storage 업로드 재시도 한도를 초과했습니다. 네트워크 또는 Storage 설정을 확인해주세요.";
    case "storage/upload-stalled":
      return "동영상 업로드가 45초 동안 진행되지 않았습니다. Storage bucket 생성 여부와 Rules를 확인해주세요.";
    case "storage/upload-timeout":
      return "동영상 업로드 시간이 너무 오래 걸려 취소했습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.";
    case "storage/unknown":
      return "Firebase Storage에서 알 수 없는 오류가 발생했습니다. Storage bucket과 Rules를 확인해주세요.";
    default:
      return `동영상 업로드에 실패했습니다. ${error?.code || error?.message || ""}`;
  }
}
