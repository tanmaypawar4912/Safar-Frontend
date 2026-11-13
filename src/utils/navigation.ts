import type { UserRole } from "../types/auth";

export function getRoleHomePath(role: UserRole | string | undefined): string {
  if (role === "admin") return "/admin";
  if (role === "driver") return "/driver";
  return "/customer";
}

/**
 * Accept only same-origin, role-appropriate in-app return paths.
 * This prevents a redirect supplied in navigation state from becoming an
 * open redirect or sending a signed-in user into another role's workspace.
 */
export function getSafeReturnPath(
  role: UserRole | string | undefined,
  requestedPath: unknown,
): string | null {
  if (typeof requestedPath !== "string") return null;
  if (!requestedPath.startsWith("/") || requestedPath.startsWith("//") || requestedPath.includes("\\")) return null;

  let parsed: URL;
  try {
    parsed = new URL(requestedPath, "https://logigo.local");
  } catch {
    return null;
  }
  if (parsed.origin !== "https://logigo.local") return null;

  const pathname = parsed.pathname;
  if (["/login", "/register", "/forgot-password", "/reset-password"].includes(pathname)) return null;

  if (pathname === "/book") return role === "customer" ? `${pathname}${parsed.search}${parsed.hash}` : null;
  if (pathname === "/business") return role === "admin" ? `${pathname}${parsed.search}${parsed.hash}` : null;

  const rolePrefix = `/${role}`;
  if ((role === "customer" || role === "driver" || role === "admin") && (pathname === rolePrefix || pathname.startsWith(`${rolePrefix}/`))) {
    return `${pathname}${parsed.search}${parsed.hash}`;
  }

  return null;
}
