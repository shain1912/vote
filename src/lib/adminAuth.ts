// sessionStorage-backed cache for the admin passphrase — same mechanic as
// the student/judge identity caches (see useStudentSession.ts / JudgePage's
// SESSION_KEY), just storing the passphrase itself instead of an RPC
// result. Kept only for this browser tab's session, and is NOT itself a
// trusted credential: every admin RPC re-verifies it server-side, so a
// tampered/forged value here just gets a "forbidden" error back.
const ADMIN_PASSPHRASE_KEY = 'makerthon:admin-passphrase'

export function loadAdminPassphrase(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_PASSPHRASE_KEY)
  } catch {
    return null
  }
}

export function storeAdminPassphrase(passphrase: string | null) {
  try {
    if (passphrase) sessionStorage.setItem(ADMIN_PASSPHRASE_KEY, passphrase)
    else sessionStorage.removeItem(ADMIN_PASSPHRASE_KEY)
  } catch {
    // sessionStorage can be unavailable in some environments — not fatal.
  }
}

/** True for the "forbidden" error every passphrase-gated admin RPC raises
 * when the cached passphrase is missing/wrong — the signal to clear the
 * cache and bounce back to /admin/login instead of showing a dead error. */
export function isForbiddenError(message: string): boolean {
  return message.includes('forbidden')
}
