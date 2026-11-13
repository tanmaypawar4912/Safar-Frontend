
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import api from "../services/api";
import type {
  AuthResponse,
  LoginData,
  RegisterData,
  User,
} from "../types/auth";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginData) => Promise<AuthResponse>;
  register: (data: RegisterData) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

interface AuthProviderProps {
  children: ReactNode;
}

const AUTH_SYNC_KEY = "logigo:auth-session-sync";
const AUTH_CHANNEL_NAME = "logigo-auth-session";

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const requestVersionRef = useRef(0);
  const currentUserRequestRef = useRef<Promise<void> | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Notify other tabs without sharing any credentials or tokens.
  const notifyOtherTabs = useCallback(() => {
    try {
      channelRef.current?.postMessage({
        type: "SESSION_CHANGED",
      });
    } catch {
      // BroadcastChannel may be unavailable.
    }

    try {
      window.localStorage.setItem(
        AUTH_SYNC_KEY,
        `${Date.now()}-${Math.random()}`
      );
    } catch {
      // Local storage may be blocked.
    }
  }, []);

  // Always obtain the authenticated user from the backend.
  const fetchCurrentUser = useCallback(async (): Promise<void> => {
    if (currentUserRequestRef.current) {
      return currentUserRequestRef.current;
    }

    const requestVersion = ++requestVersionRef.current;

    let request: Promise<void>;

    request = (async () => {
      try {
        const response = await api.get("/auth/me");

        // Ignore an old response if login/logout happened meanwhile.
        if (requestVersion !== requestVersionRef.current) {
          return;
        }

        if (response.data?.success && response.data?.user) {
          setUser(response.data.user);
        } else {
          setUser(null);
        }
      } catch {
        if (requestVersion === requestVersionRef.current) {
          setUser(null);
        }
      } finally {
        if (requestVersion === requestVersionRef.current) {
          currentUserRequestRef.current = null;
        }
      }
    })();

    currentUserRequestRef.current = request;

    return request;
  }, []);

  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        await fetchCurrentUser();
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    // Initial session restoration.
    void restoreSession();

    // Account switching between browser tabs.
    const syncSession = () => {
      void fetchCurrentUser();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncSession();
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (
        event.key === AUTH_SYNC_KEY &&
        event.newValue
      ) {
        syncSession();
      }
    };

    window.addEventListener("focus", syncSession);

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    window.addEventListener(
      "storage",
      handleStorageChange
    );

    // Faster synchronization between same-origin tabs.
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(AUTH_CHANNEL_NAME);

      channelRef.current = channel;

      channel.onmessage = (event) => {
        if (event.data?.type === "SESSION_CHANGED") {
          syncSession();
        }
      };
    }

    return () => {
      mounted = false;

      window.removeEventListener("focus", syncSession);

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      window.removeEventListener(
        "storage",
        handleStorageChange
      );

      channelRef.current?.close();
      channelRef.current = null;
    };
  }, [fetchCurrentUser]);

  const login = async (data: LoginData) => {
    const response = await api.post("/auth/login", data);

    if (response.data?.success && response.data?.user) {
      // Invalidate any older /auth/me request.
      requestVersionRef.current += 1;
      currentUserRequestRef.current = null;

      setUser(response.data.user);

      notifyOtherTabs();
    }

    return response.data;
  };

  const register = async (data: RegisterData) => {
    const response = await api.post("/auth/register", data);

    if (response.data?.success && response.data?.user) {
      requestVersionRef.current += 1;
      currentUserRequestRef.current = null;

      setUser(response.data.user);

      notifyOtherTabs();
    }

    return response.data;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      requestVersionRef.current += 1;
      currentUserRequestRef.current = null;

      setUser(null);

      notifyOtherTabs();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: Boolean(user),
        login,
        register,
        logout,
        refreshUser: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
};
