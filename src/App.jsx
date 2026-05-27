import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Cloud,
  Clock3,
  Database,
  FileVideo,
  Globe2,
  LogIn,
  LogOut,
  LockKeyhole,
  MapPin,
  Mountain,
  Pencil,
  Plus,
  Save,
  ShieldAlert,
  Smile,
  StickyNote,
  Trash2,
  Upload,
  User,
  UserPlus,
  X,
} from "lucide-react";
import {
  createAccount,
  deleteAccount,
  getFriendlyAuthError,
  signIn,
  signOutAccount,
  subscribeToAuthChanges,
  updateDisplayName,
} from "./lib/authStore";
import { hasFirebaseConfig, hasFirebaseStorageConfig } from "./lib/firebase";
import {
  addFirebaseSession,
  deleteAllFirebaseSessions,
  deleteFirebaseSession,
  subscribeToPublicFirebaseSessions,
  subscribeToFirebaseSessions,
  updateFirebaseSession,
  updateFirebaseSessionUserName,
} from "./lib/sessionStore";
import {
  deleteFirebaseVideo,
  getFriendlyVideoError,
  uploadFirebaseVideo,
} from "./lib/videoStore";

const STORAGE_KEY = "climblog.sessions.v1";
const MAX_VIDEO_SIZE_BYTES = 200 * 1024 * 1024;

const grades = [
  "VB",
  "V0",
  "V1",
  "V2",
  "V3",
  "V4",
  "V5",
  "V6",
  "V7",
  "V8",
  "V9",
  "V10",
  "V11",
  "V12",
];

const conditionLabels = {
  1: "무거움",
  2: "아쉬움",
  3: "보통",
  4: "좋음",
  5: "최상",
};

const getToday = () => {
  const now = new Date();
  const offsetDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
};

const emptyForm = {
  date: getToday(),
  gym: "",
  duration: "",
  grade: "V3",
  condition: 3,
  memo: "",
  visibility: "private",
};

const emptyAuthForm = {
  displayName: "",
  email: "",
  password: "",
};

function loadSessions() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${dateString}T00:00:00`));
}

function compareSessions(a, b) {
  const dateSort = b.date.localeCompare(a.date);
  if (dateSort !== 0) return dateSort;
  return b.createdAt.localeCompare(a.createdAt);
}

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatFileSize(bytes) {
  if (!bytes) return "";

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function gradeRank(grade) {
  const index = grades.indexOf(grade);
  return index === -1 ? -1 : index;
}

function getUserName(user) {
  return user?.displayName || user?.email?.split("@")[0] || "Climber";
}

function normalizeAuthUser(user) {
  if (!user) return null;

  return {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || "",
  };
}

function App() {
  const [sessions, setSessions] = useState(() =>
    hasFirebaseConfig ? [] : loadSessions(),
  );
  const [publicSessions, setPublicSessions] = useState([]);
  const [recordView, setRecordView] = useState("mine");
  const [form, setForm] = useState(emptyForm);
  const [authForm, setAuthForm] = useState(emptyAuthForm);
  const [authMode, setAuthMode] = useState("login");
  const [currentUser, setCurrentUser] = useState(null);
  const [profileName, setProfileName] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [editingSessionId, setEditingSessionId] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [videoInputKey, setVideoInputKey] = useState(0);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState("");
  const [uploadProgress, setUploadProgress] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(hasFirebaseConfig);
  const [isAuthWorking, setIsAuthWorking] = useState(false);
  const [isLoading, setIsLoading] = useState(hasFirebaseConfig);
  const [isPublicLoading, setIsPublicLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (hasFirebaseConfig) return undefined;

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (!videoFile) {
      setVideoPreviewUrl("");
      return undefined;
    }

    const nextPreviewUrl = URL.createObjectURL(videoFile);
    setVideoPreviewUrl(nextPreviewUrl);

    return () => {
      URL.revokeObjectURL(nextPreviewUrl);
    };
  }, [videoFile]);

  useEffect(() => {
    if (!hasFirebaseConfig) return undefined;

    let unsubscribe = () => {};
    let isMounted = true;

    subscribeToAuthChanges(
      (user) => {
        if (!isMounted) return;
        const nextUser = normalizeAuthUser(user);
        setCurrentUser(nextUser);
        setProfileName(user?.displayName || "");
        setIsAuthLoading(false);
        setErrorMessage("");
      },
      () => {
        if (!isMounted) return;
        setErrorMessage("로그인 상태를 확인하지 못했습니다.");
        setIsAuthLoading(false);
      },
    )
      .then((nextUnsubscribe) => {
        if (!isMounted) {
          nextUnsubscribe();
          return;
        }

        unsubscribe = nextUnsubscribe;
      })
      .catch(() => {
        if (!isMounted) return;
        setErrorMessage("Firebase Auth를 초기화하지 못했습니다.");
        setIsAuthLoading(false);
      });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!hasFirebaseConfig) return undefined;

    if (!currentUser) {
      setSessions([]);
      setIsLoading(false);
      return undefined;
    }

    let unsubscribe = () => {};
    let isMounted = true;

    setIsLoading(true);

    subscribeToFirebaseSessions(
      currentUser.uid,
      (nextSessions) => {
        if (!isMounted) return;
        setSessions(nextSessions);
        setIsLoading(false);
        setErrorMessage("");
      },
      () => {
        if (!isMounted) return;
        setErrorMessage("Firebase에서 기록을 불러오지 못했습니다.");
        setIsLoading(false);
      },
    )
      .then((nextUnsubscribe) => {
        if (!isMounted) {
          nextUnsubscribe();
          return;
        }

        unsubscribe = nextUnsubscribe;
      })
      .catch(() => {
        if (!isMounted) return;
        setErrorMessage("Firebase 연결을 초기화하지 못했습니다.");
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!hasFirebaseConfig) return undefined;

    if (!currentUser) {
      setPublicSessions([]);
      setIsPublicLoading(false);
      return undefined;
    }

    let unsubscribe = () => {};
    let isMounted = true;

    setIsPublicLoading(true);

    subscribeToPublicFirebaseSessions(
      (nextSessions) => {
        if (!isMounted) return;
        setPublicSessions(nextSessions);
        setIsPublicLoading(false);
      },
      () => {
        if (!isMounted) return;
        setErrorMessage(
          "공개 피드를 불러오지 못했습니다. Firebase Rules의 공개 읽기 권한을 확인해주세요.",
        );
        setIsPublicLoading(false);
      },
    )
      .then((nextUnsubscribe) => {
        if (!isMounted) {
          nextUnsubscribe();
          return;
        }

        unsubscribe = nextUnsubscribe;
      })
      .catch(() => {
        if (!isMounted) return;
        setErrorMessage(
          "공개 피드 연결을 초기화하지 못했습니다. Firebase Rules의 공개 읽기 권한을 확인해주세요.",
        );
        setIsPublicLoading(false);
      });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [currentUser?.uid]);

  const sortedSessions = useMemo(
    () => [...sessions].sort(compareSessions),
    [sessions],
  );

  const sortedPublicSessions = useMemo(
    () => [...publicSessions].sort(compareSessions),
    [publicSessions],
  );

  const publicFeedSessions = useMemo(() => {
    const sessionMap = new Map();

    sortedPublicSessions.forEach((session) => {
      sessionMap.set(session.id, session);
    });

    sortedSessions
      .filter((session) => session.visibility === "public")
      .forEach((session) => {
        sessionMap.set(session.id, session);
      });

    return [...sessionMap.values()].sort(compareSessions);
  }, [sortedPublicSessions, sortedSessions]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthlyVisits = sessions.filter((session) =>
      session.date.startsWith(monthPrefix),
    ).length;
    const highestGrade = sessions.reduce((best, session) => {
      if (!best) return session.grade;
      return gradeRank(session.grade) > gradeRank(best) ? session.grade : best;
    }, "");
    const conditionTotal = sessions.reduce(
      (sum, session) => sum + Number(session.condition),
      0,
    );

    return {
      totalSessions: sessions.length,
      monthlyVisits,
      highestGrade: highestGrade || "-",
      averageCondition: sessions.length
        ? (conditionTotal / sessions.length).toFixed(1)
        : "-",
    };
  }, [sessions]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: name === "condition" ? Number(value) : value,
    }));
  };

  const handleAuthChange = (event) => {
    const { name, value } = event.target;
    setAuthForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const toggleSessionVisibility = () => {
    setForm((current) => ({
      ...current,
      visibility: current.visibility === "public" ? "private" : "public",
    }));
  };

  const handleVideoChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      setVideoFile(null);
      return;
    }

    if (!file.type.startsWith("video/")) {
      setErrorMessage("동영상 파일만 업로드할 수 있습니다.");
      event.target.value = "";
      setVideoFile(null);
      return;
    }

    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      setErrorMessage("동영상은 200MB 이하만 업로드할 수 있습니다.");
      event.target.value = "";
      setVideoFile(null);
      return;
    }

    setErrorMessage("");
    setVideoFile(file);
  };

  const clearSelectedVideo = () => {
    setVideoFile(null);
    setUploadProgress(null);
    setVideoInputKey((key) => key + 1);
  };

  const cancelEditSession = () => {
    setEditingSessionId("");
    setForm({ ...emptyForm, date: getToday() });
    clearSelectedVideo();
    setErrorMessage("");
  };

  const startEditSession = (session) => {
    setEditingSessionId(session.id);
    setForm({
      date: session.date,
      gym: session.gym,
      duration: String(session.duration || ""),
      grade: session.grade,
      condition: Number(session.condition) || 3,
      memo: session.memo || "",
      visibility: session.visibility === "public" ? "public" : "private",
    });
    clearSelectedVideo();
    setErrorMessage("");
    window.setTimeout(() => {
      document
        .getElementById("session-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setIsAuthWorking(true);
    setErrorMessage("");

    try {
      const user =
        authMode === "signup"
          ? await createAccount(authForm)
          : await signIn(authForm);

      if (user) {
        setCurrentUser({
          ...normalizeAuthUser(user),
          displayName: authMode === "signup" ? authForm.displayName : user.displayName,
        });
        setProfileName(
          authMode === "signup" ? authForm.displayName : user.displayName || "",
        );
      }

      setAuthForm(emptyAuthForm);
    } catch (error) {
      setErrorMessage(getFriendlyAuthError(error));
    } finally {
      setIsAuthWorking(false);
    }
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setIsAuthWorking(true);
    setErrorMessage("");

    try {
      const nextDisplayName = profileName.trim();
      const nextUser = currentUser
        ? { ...currentUser, displayName: nextDisplayName }
        : null;

      await updateDisplayName(profileName);

      if (nextUser) {
        await updateFirebaseSessionUserName(
          nextUser.uid,
          getUserName(nextUser),
        );
        setCurrentUser(nextUser);
      }
    } catch (error) {
      setErrorMessage(getFriendlyAuthError(error));
    } finally {
      setIsAuthWorking(false);
    }
  };

  const handleSignOut = async () => {
    setIsAuthWorking(true);
    setErrorMessage("");

    try {
      await signOutAccount();
      setSessions([]);
      setPublicSessions([]);
      setRecordView("mine");
      setDeletePassword("");
      setEditingSessionId("");
      setForm({ ...emptyForm, date: getToday() });
      clearSelectedVideo();
    } catch (error) {
      setErrorMessage(getFriendlyAuthError(error));
    } finally {
      setIsAuthWorking(false);
    }
  };

  const handleDeleteAccount = async (event) => {
    event.preventDefault();

    if (!currentUser) return;

    if (!deletePassword) {
      setErrorMessage("탈퇴하려면 비밀번호를 입력해주세요.");
      return;
    }

    const confirmed = window.confirm(
      "계정과 내 클라이밍 기록을 모두 삭제할까요?",
    );

    if (!confirmed) return;

    setIsAuthWorking(true);
    setErrorMessage("");

    try {
      await Promise.all(
        sessions
          .filter((session) => session.videoPath)
          .map((session) => deleteFirebaseVideo(session.videoPath)),
      );
      await deleteAllFirebaseSessions(currentUser.uid);
      await deleteAccount(deletePassword);
      setSessions([]);
      setPublicSessions([]);
      setRecordView("mine");
      setCurrentUser(null);
      setDeletePassword("");
      setEditingSessionId("");
      setForm({ ...emptyForm, date: getToday() });
      clearSelectedVideo();
    } catch (error) {
      setErrorMessage(getFriendlyAuthError(error));
    } finally {
      setIsAuthWorking(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (hasFirebaseConfig && !currentUser) {
      setErrorMessage("로그인 후 기록을 저장할 수 있습니다.");
      return;
    }

    const nextSession = {
      date: form.date,
      gym: form.gym.trim(),
      duration: Number(form.duration),
      grade: form.grade,
      condition: Number(form.condition),
      memo: form.memo.trim(),
      visibility: form.visibility,
      updatedAt: new Date().toISOString(),
    };

    setIsSaving(true);
    setErrorMessage("");

    let uploadedVideo = null;

    try {
      if (hasFirebaseConfig) {
        if (!editingSessionId && videoFile) {
          uploadedVideo = await uploadFirebaseVideo(
            currentUser.uid,
            videoFile,
            setUploadProgress,
          );
        }

        if (editingSessionId) {
          await updateFirebaseSession(editingSessionId, nextSession);
        } else {
          await addFirebaseSession({
            ...nextSession,
            ...(uploadedVideo || {}),
            userId: currentUser.uid,
            userEmail: currentUser.email || "",
            userName: getUserName(currentUser),
            createdAt: new Date().toISOString(),
          });
        }
      } else {
        if (editingSessionId) {
          setSessions((current) =>
            current.map((session) =>
              session.id === editingSessionId
                ? { ...session, ...nextSession }
                : session,
            ),
          );
        } else {
          setSessions((current) => [
            { ...nextSession, id: createId(), createdAt: new Date().toISOString() },
            ...current,
          ]);
        }
      }

      setForm({ ...emptyForm, date: form.date });
      setEditingSessionId("");
      clearSelectedVideo();
    } catch (error) {
      if (uploadedVideo?.videoPath) {
        try {
          await deleteFirebaseVideo(uploadedVideo.videoPath);
        } catch {
          // Best-effort cleanup. The original save error is more useful here.
        }
      }

      setErrorMessage(
        getFriendlyVideoError(error),
      );
    } finally {
      setIsSaving(false);
      setUploadProgress(null);
    }
  };

  const deleteSession = async (id) => {
    setErrorMessage("");
    const targetSession = sessions.find((session) => session.id === id);

    try {
      if (hasFirebaseConfig) {
        await deleteFirebaseVideo(targetSession?.videoPath);
        await deleteFirebaseSession(id);
      } else {
        setSessions((current) => current.filter((session) => session.id !== id));
      }

      if (editingSessionId === id) {
        cancelEditSession();
      }
    } catch {
      setErrorMessage("기록을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.");
    }
  };

  const statItems = [
    {
      label: "총 세션",
      value: stats.totalSessions,
      unit: "회",
      icon: BarChart3,
      accent: "bg-emerald-500",
    },
    {
      label: "이번 달",
      value: stats.monthlyVisits,
      unit: "회",
      icon: CalendarDays,
      accent: "bg-cyan-500",
    },
    {
      label: "최고 난이도",
      value: stats.highestGrade,
      unit: "",
      icon: Mountain,
      accent: "bg-rose-500",
    },
    {
      label: "평균 컨디션",
      value: stats.averageCondition,
      unit: "/5",
      icon: Smile,
      accent: "bg-amber-500",
    },
  ];

  const isFirebaseSignedOut = hasFirebaseConfig && !currentUser;
  const isEditingSession = Boolean(editingSessionId);
  const editingSession = sessions.find(
    (session) => session.id === editingSessionId,
  );
  const isVideoUploadDisabled =
    !hasFirebaseConfig ||
    !currentUser ||
    !hasFirebaseStorageConfig ||
    isSaving ||
    isEditingSession;
  const isSessionFormDisabled =
    isSaving ||
    isFirebaseSignedOut ||
    (Boolean(videoFile) && !hasFirebaseStorageConfig);
  const displayedSessions =
    recordView === "public" ? publicFeedSessions : sortedSessions;
  const isRecordListLoading =
    recordView === "public" ? isPublicLoading : isLoading;
  const recordListTitle =
    recordView === "public" ? "공개 피드" : "기록 목록";

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="grid gap-5 border-b border-zinc-200 pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm font-semibold text-zinc-700 shadow-sm">
              <Mountain className="h-4 w-4 text-rose-500" aria-hidden="true" />
              Local climbing log
            </div>
            <h1 className="text-4xl font-black tracking-normal text-zinc-950 sm:text-5xl">
              ClimbLog
            </h1>
          </div>
          <div className="flex min-h-12 items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 shadow-sm">
            {hasFirebaseConfig ? (
              <Cloud
                className="h-5 w-5 text-cyan-600"
                aria-hidden="true"
              />
            ) : (
              <Database
                className="h-5 w-5 text-emerald-600"
                aria-hidden="true"
              />
            )}
            <span>{hasFirebaseConfig ? "Firebase Firestore" : "Local mode"}</span>
          </div>
        </header>

        {errorMessage && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            {errorMessage}
          </div>
        )}

        {hasFirebaseConfig && (
          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            {isAuthLoading ? (
              <div className="flex min-h-20 items-center gap-3 text-sm font-bold text-zinc-600">
                <Cloud className="h-5 w-5 text-cyan-600" aria-hidden="true" />
                로그인 상태 확인 중
              </div>
            ) : currentUser ? (
              <div className="grid gap-5 xl:grid-cols-[1fr_1fr_auto] xl:items-end">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">
                    <User className="h-4 w-4" aria-hidden="true" />
                    로그인됨
                  </div>
                  <p className="text-2xl font-black tracking-normal">
                    {getUserName(currentUser)}
                  </p>
                  <p className="mt-1 break-all text-sm font-semibold text-zinc-500">
                    {currentUser.email}
                  </p>
                </div>

                <form className="grid gap-2" onSubmit={handleProfileSubmit}>
                  <label className="grid gap-2 text-sm font-bold text-zinc-700">
                    닉네임
                    <input
                      className="h-11 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-base font-semibold outline-none transition focus:border-zinc-950 focus:bg-white"
                      type="text"
                      value={profileName}
                      onChange={(event) => setProfileName(event.target.value)}
                      placeholder="클라이머 이름"
                    />
                  </label>
                  <button
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-black text-zinc-800 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-400"
                    type="submit"
                    disabled={isAuthWorking}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    수정
                  </button>
                </form>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  <button
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 text-sm font-black text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                    type="button"
                    onClick={handleSignOut}
                    disabled={isAuthWorking}
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    로그아웃
                  </button>
                  <form
                    className="grid gap-2 sm:grid-cols-[1fr_auto] xl:grid-cols-1"
                    onSubmit={handleDeleteAccount}
                  >
                    <input
                      className="h-11 min-w-0 rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm font-semibold outline-none transition placeholder:text-rose-300 focus:border-rose-500 focus:bg-white"
                      type="password"
                      value={deletePassword}
                      onChange={(event) => setDeletePassword(event.target.value)}
                      placeholder="탈퇴 비밀번호"
                      autoComplete="current-password"
                    />
                    <button
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-4 text-sm font-black text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-rose-300"
                      type="submit"
                      disabled={isAuthWorking}
                    >
                      <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                      탈퇴
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <form
                className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end"
                onSubmit={handleAuthSubmit}
              >
                <div>
                  <div className="mb-4 inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1">
                    <button
                      className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-black transition ${
                        authMode === "login"
                          ? "bg-zinc-950 text-white shadow-sm"
                          : "text-zinc-500 hover:text-zinc-900"
                      }`}
                      type="button"
                      onClick={() => setAuthMode("login")}
                    >
                      <LogIn className="h-4 w-4" aria-hidden="true" />
                      로그인
                    </button>
                    <button
                      className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-black transition ${
                        authMode === "signup"
                          ? "bg-zinc-950 text-white shadow-sm"
                          : "text-zinc-500 hover:text-zinc-900"
                      }`}
                      type="button"
                      onClick={() => setAuthMode("signup")}
                    >
                      <UserPlus className="h-4 w-4" aria-hidden="true" />
                      회원가입
                    </button>
                  </div>

                  {authMode === "signup" && (
                    <label className="grid gap-2 text-sm font-bold text-zinc-700">
                      닉네임
                      <input
                        className="h-11 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-base font-semibold outline-none transition focus:border-zinc-950 focus:bg-white"
                        type="text"
                        name="displayName"
                        value={authForm.displayName}
                        onChange={handleAuthChange}
                        placeholder="클라이머 이름"
                      />
                    </label>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-bold text-zinc-700">
                    이메일
                    <input
                      className="h-11 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-base font-semibold outline-none transition focus:border-zinc-950 focus:bg-white"
                      type="email"
                      name="email"
                      value={authForm.email}
                      onChange={handleAuthChange}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-zinc-700">
                    비밀번호
                    <input
                      className="h-11 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-base font-semibold outline-none transition focus:border-zinc-950 focus:bg-white"
                      type="password"
                      name="password"
                      value={authForm.password}
                      onChange={handleAuthChange}
                      placeholder="6자 이상"
                      autoComplete={
                        authMode === "signup" ? "new-password" : "current-password"
                      }
                      required
                    />
                  </label>
                </div>

                <button
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-5 text-sm font-black text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                  type="submit"
                  disabled={isAuthWorking}
                >
                  {authMode === "signup" ? (
                    <UserPlus className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                  )}
                  {isAuthWorking
                    ? "처리 중"
                    : authMode === "signup"
                      ? "가입"
                      : "로그인"}
                </button>
              </form>
            )}
          </section>
        )}

        <section
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Climbing statistics"
        >
          {statItems.map((item) => {
            const Icon = item.icon;

            return (
              <article
                key={item.label}
                className="min-h-32 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-6 flex items-center justify-between">
                  <div
                    className={`grid h-10 w-10 place-items-center rounded-lg ${item.accent} text-white`}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <span className="text-sm font-semibold text-zinc-500">
                    {item.label}
                  </span>
                </div>
                <p className="flex items-end gap-1 text-3xl font-black tracking-normal">
                  <span>{item.value}</span>
                  <span className="pb-1 text-sm font-bold text-zinc-500">
                    {item.unit}
                  </span>
                </p>
              </article>
            );
          })}
        </section>

        <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
          <section
            className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
            id="session-form"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black tracking-normal">
                  {isEditingSession ? "세션 수정" : "세션 추가"}
                </h2>
                {isEditingSession && editingSession && (
                  <p className="mt-1 text-sm font-bold text-zinc-500">
                    {editingSession.gym} 기록을 수정 중입니다.
                  </p>
                )}
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-zinc-950 text-white">
                {isEditingSession ? (
                  <Pencil className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Plus className="h-5 w-5" aria-hidden="true" />
                )}
              </div>
            </div>

            {isFirebaseSignedOut && (
              <div className="mb-4 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-bold text-cyan-800">
                로그인 후 기록을 저장할 수 있습니다.
              </div>
            )}

            <form className="grid gap-4" onSubmit={handleSubmit}>
              <label className="grid gap-2 text-sm font-bold text-zinc-700">
                <span className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-cyan-600" />
                  날짜
                </span>
                <input
                  className="h-12 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-base font-semibold outline-none transition focus:border-zinc-950 focus:bg-white"
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={handleChange}
                  required
                />
              </label>

              <label className="grid gap-2 text-sm font-bold text-zinc-700">
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                  암장 이름
                </span>
                <input
                  className="h-12 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-base font-semibold outline-none transition placeholder:text-zinc-400 focus:border-zinc-950 focus:bg-white"
                  type="text"
                  name="gym"
                  value={form.gym}
                  onChange={handleChange}
                  placeholder="예: 더클라임 홍대"
                  required
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold text-zinc-700">
                  <span className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-amber-600" />
                    운동 시간
                  </span>
                  <div className="flex h-12 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 focus-within:border-zinc-950 focus-within:bg-white">
                    <input
                      className="min-w-0 flex-1 bg-transparent px-3 text-base font-semibold outline-none"
                      type="number"
                      name="duration"
                      min="1"
                      step="1"
                      value={form.duration}
                      onChange={handleChange}
                      placeholder="90"
                      required
                    />
                    <span className="grid w-14 place-items-center border-l border-zinc-200 text-sm font-black text-zinc-500">
                      분
                    </span>
                  </div>
                </label>

                <label className="grid gap-2 text-sm font-bold text-zinc-700">
                  <span className="flex items-center gap-2">
                    <Mountain className="h-4 w-4 text-rose-600" />
                    최고 난이도
                  </span>
                  <select
                    className="h-12 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-base font-semibold outline-none transition focus:border-zinc-950 focus:bg-white"
                    name="grade"
                    value={form.grade}
                    onChange={handleChange}
                  >
                    {grades.map((grade) => (
                      <option key={grade} value={grade}>
                        {grade}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="grid gap-3 text-sm font-bold text-zinc-700">
                <span className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Smile className="h-4 w-4 text-lime-600" />
                    컨디션
                  </span>
                  <span className="rounded-full bg-lime-100 px-3 py-1 text-xs font-black text-lime-800">
                    {conditionLabels[form.condition]}
                  </span>
                </span>
                <input
                  className="h-2 w-full accent-lime-600"
                  type="range"
                  name="condition"
                  min="1"
                  max="5"
                  step="1"
                  value={form.condition}
                  onChange={handleChange}
                />
                <div className="flex justify-between text-xs font-black text-zinc-400">
                  <span>1</span>
                  <span>2</span>
                  <span>3</span>
                  <span>4</span>
                  <span>5</span>
                </div>
              </label>

              <label className="grid gap-2 text-sm font-bold text-zinc-700">
                <span className="flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-violet-600" />
                  메모
                </span>
                <textarea
                  className="min-h-28 resize-y rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-base font-semibold outline-none transition placeholder:text-zinc-400 focus:border-zinc-950 focus:bg-white"
                  name="memo"
                  value={form.memo}
                  onChange={handleChange}
                  placeholder="프로젝트, 무브, 다음에 시도할 문제"
                />
              </label>

              <label className="flex min-h-14 items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm font-bold text-zinc-700">
                <span className="flex min-w-0 items-center gap-2">
                  {form.visibility === "public" ? (
                    <Globe2
                      className="h-4 w-4 shrink-0 text-cyan-600"
                      aria-hidden="true"
                    />
                  ) : (
                    <LockKeyhole
                      className="h-4 w-4 shrink-0 text-zinc-500"
                      aria-hidden="true"
                    />
                  )}
                  <span>공개 기록</span>
                </span>
                <input
                  className="h-5 w-5 shrink-0 accent-cyan-600"
                  type="checkbox"
                  checked={form.visibility === "public"}
                  onChange={toggleSessionVisibility}
                />
              </label>

              {hasFirebaseStorageConfig && !isEditingSession && (
                <div className="grid gap-3 text-sm font-bold text-zinc-700">
                  <span className="flex items-center gap-2">
                    <FileVideo className="h-4 w-4 text-cyan-600" />
                    문제 영상
                  </span>
                  <label
                    className={`grid min-h-24 cursor-pointer place-items-center rounded-lg border border-dashed px-4 py-5 text-center transition ${
                      isVideoUploadDisabled
                        ? "cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-400"
                        : "border-cyan-200 bg-cyan-50 text-cyan-900 hover:border-cyan-300 hover:bg-cyan-100"
                    }`}
                  >
                    <input
                      key={videoInputKey}
                      className="sr-only"
                      type="file"
                      accept="video/*"
                      onChange={handleVideoChange}
                      disabled={isVideoUploadDisabled}
                    />
                    <span className="inline-flex items-center gap-2 text-sm font-black">
                      <Upload className="h-4 w-4" aria-hidden="true" />
                      동영상 선택
                    </span>
                    <span className="mt-1 text-xs font-bold text-zinc-500">
                      MP4/MOV 등, 최대 200MB
                    </span>
                  </label>

                  {videoFile && (
                    <div className="rounded-lg border border-zinc-200 bg-white p-3">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-zinc-900">
                            {videoFile.name}
                          </p>
                          <p className="mt-1 text-xs font-bold text-zinc-500">
                            {formatFileSize(videoFile.size)}
                          </p>
                        </div>
                        <button
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-300"
                          type="button"
                          onClick={clearSelectedVideo}
                          disabled={isSaving}
                          aria-label="선택한 동영상 제거"
                          title="제거"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>

                      {videoPreviewUrl && (
                        <video
                          className="aspect-video w-full rounded-lg bg-zinc-950 object-contain"
                          src={videoPreviewUrl}
                          controls
                          playsInline
                        />
                      )}

                      {uploadProgress !== null && (
                        <div className="mt-3">
                          <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className="h-full rounded-full bg-cyan-500 transition-all"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                          <p className="mt-1 text-right text-xs font-black text-cyan-700">
                            업로드 {uploadProgress}%
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                <button
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 text-base font-black text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-4 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:bg-zinc-400"
                  type="submit"
                  disabled={isSessionFormDisabled}
                >
                  <Save className="h-5 w-5" aria-hidden="true" />
                  {isFirebaseSignedOut
                    ? "로그인 필요"
                    : isSaving
                      ? "저장 중"
                      : isEditingSession
                        ? "수정 저장"
                        : "기록 저장"}
                </button>
                {isEditingSession && (
                  <button
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-base font-black text-zinc-700 shadow-sm transition hover:bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-300"
                    type="button"
                    onClick={cancelEditSession}
                    disabled={isSaving}
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                    취소
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="min-w-0">
            <div className="mb-4 flex min-h-10 items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black tracking-normal">
                  {recordListTitle}
                </h2>
                <p className="mt-1 text-sm font-bold text-zinc-500">
                  최신순
                </p>
              </div>
              <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-1 shadow-sm">
                <button
                  className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-black transition ${
                    recordView === "mine"
                      ? "bg-zinc-950 text-white"
                      : "text-zinc-500 hover:text-zinc-900"
                  }`}
                  type="button"
                  onClick={() => setRecordView("mine")}
                >
                  <User className="h-4 w-4" aria-hidden="true" />
                  내 기록
                </button>
                <button
                  className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-black transition ${
                    recordView === "public"
                      ? "bg-zinc-950 text-white"
                      : "text-zinc-500 hover:text-zinc-900"
                  }`}
                  type="button"
                  onClick={() => setRecordView("public")}
                  disabled={isFirebaseSignedOut}
                >
                  <Globe2 className="h-4 w-4" aria-hidden="true" />
                  공개 피드
                </button>
              </div>
            </div>

            {isRecordListLoading ? (
              <div className="grid min-h-80 place-items-center rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm">
                <div>
                  <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-lg bg-cyan-100 text-cyan-700">
                    <Cloud className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <p className="text-lg font-black text-zinc-900">
                    기록을 불러오는 중입니다
                  </p>
                </div>
              </div>
            ) : displayedSessions.length > 0 ? (
              <div className="grid gap-3">
                {displayedSessions.map((session) => {
                  const canManageSession =
                    !hasFirebaseConfig || session.userId === currentUser?.uid;

                  return (
                  <article
                    className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
                    key={session.id}
                  >
                    <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
                      <div className="min-w-0">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-zinc-950 px-3 py-1 text-sm font-black text-white">
                            {session.grade}
                          </span>
                          <span className="rounded-full bg-cyan-100 px-3 py-1 text-sm font-black text-cyan-900">
                            {formatDate(session.date)}
                          </span>
                          <span className="rounded-full bg-lime-100 px-3 py-1 text-sm font-black text-lime-900">
                            컨디션 {session.condition}/5
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-black ${
                              session.visibility === "public"
                                ? "bg-cyan-100 text-cyan-900"
                                : "bg-zinc-100 text-zinc-600"
                            }`}
                          >
                            {session.visibility === "public" ? (
                              <Globe2 className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <LockKeyhole
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            )}
                            {session.visibility === "public" ? "공개" : "비공개"}
                          </span>
                        </div>
                        <h3 className="truncate text-lg font-black tracking-normal">
                          {session.gym}
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm font-bold text-zinc-500">
                          {recordView === "public" && (
                            <span className="inline-flex items-center gap-1">
                              <User className="h-4 w-4" aria-hidden="true" />
                              {session.userName || "Climber"}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-4 w-4" aria-hidden="true" />
                            {session.duration}분
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Mountain className="h-4 w-4" aria-hidden="true" />
                            최고 {session.grade}
                          </span>
                        </div>
                        {session.memo && (
                          <p className="mt-4 whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-sm font-semibold leading-6 text-zinc-700">
                            {session.memo}
                          </p>
                        )}
                        {session.videoUrl && (
                          <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-950">
                            <video
                              className="aspect-video w-full object-contain"
                              src={session.videoUrl}
                              controls
                              playsInline
                              preload="metadata"
                            />
                            <div className="flex flex-wrap items-center gap-2 bg-white px-3 py-2 text-xs font-bold text-zinc-500">
                              <FileVideo
                                className="h-4 w-4 text-cyan-600"
                                aria-hidden="true"
                              />
                              <span className="min-w-0 truncate">
                                {session.videoName || "문제 영상"}
                              </span>
                              {session.videoSize > 0 && (
                                <span>{formatFileSize(session.videoSize)}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      {canManageSession && (
                        <div className="flex gap-2 md:flex-col">
                          <button
                            className="grid h-11 w-11 place-items-center rounded-lg border border-zinc-200 text-zinc-500 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-100"
                            type="button"
                            onClick={() => startEditSession(session)}
                            aria-label={`${session.gym} 기록 수정`}
                            title="수정"
                          >
                            <Pencil className="h-5 w-5" aria-hidden="true" />
                          </button>
                          <button
                            className="grid h-11 w-11 place-items-center rounded-lg border border-zinc-200 text-zinc-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-4 focus:ring-rose-100"
                            type="button"
                            onClick={() => deleteSession(session.id)}
                            aria-label={`${session.gym} 기록 삭제`}
                            title="삭제"
                          >
                            <Trash2 className="h-5 w-5" aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
                })}
              </div>
            ) : (
              <div className="grid min-h-80 place-items-center rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center shadow-sm">
                <div>
                  <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
                    <Mountain className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <p className="text-lg font-black text-zinc-900">
                    {recordView === "public"
                      ? "아직 공개 기록이 없습니다"
                      : "아직 기록이 없습니다"}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-zinc-500">
                    {recordView === "public"
                      ? "공개로 저장한 기록이 여기에 모입니다."
                      : isFirebaseSignedOut
                      ? "로그인하면 내 기록이 표시됩니다."
                      : "첫 세션을 저장하면 통계가 바로 업데이트됩니다."}
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

export default App;
