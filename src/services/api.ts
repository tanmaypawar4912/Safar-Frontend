
import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";

const LOOPBACK_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
]);

function resolveApiBaseUrl(): string {
  const pageHost = window.location.hostname || "localhost";
  const pageProtocol = window.location.protocol || "http:";
  const configuredUrl = import.meta.env.VITE_API_URL?.trim();

  if (!configuredUrl) {
    return `${pageProtocol}//${pageHost}:5000/api`;
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(configuredUrl, window.location.origin);
  } catch {
    throw new Error(
      "Invalid VITE_API_URL. Use an absolute API URL such as http://localhost:5000/api."
    );
  }

  const pageIsNotLoopback = !LOOPBACK_HOSTS.has(pageHost);
  const apiUsesLoopback = LOOPBACK_HOSTS.has(parsedUrl.hostname);

  if (pageIsNotLoopback && apiUsesLoopback) {
    parsedUrl.hostname = pageHost;
    parsedUrl.protocol = pageProtocol;
  }

  return parsedUrl.toString().replace(/\/+$/, "");
}

const API_BASE_URL = resolveApiBaseUrl();

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 20000,
  headers: {
    Accept: "application/json",
  },
});

// Separate client prevents refresh interceptor recursion.
const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 20000,
  headers: {
    Accept: "application/json",
  },
});

let refreshPromise: Promise<boolean> | null = null;

function isPublicAuthEndpoint(url?: string) {
  const path = (url || "").split("?")[0].replace(/\/+$/, "");

  return /(?:^|\/)auth\/(login|register|refresh|logout|forgot-password|reset-password)$/.test(
    path
  );
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as
      | RetryableRequestConfig
      | undefined;

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      isPublicAuthEndpoint(originalRequest.url)
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (!refreshPromise) {
      refreshPromise = refreshClient
        .post("/auth/refresh")
        .then((response) => response.status >= 200 && response.status < 300)
        .catch(() => false)
        .finally(() => {
          refreshPromise = null;
        });
    }

    const refreshed = await refreshPromise;

    if (!refreshed) {
      return Promise.reject(error);
    }

    return api(originalRequest);
  }
);

export default api;
