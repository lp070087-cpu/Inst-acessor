/** Existing activated accounts are preserved; new registrations must prove email. */
export function hasVerifiedIdentity(user: { emailVerified?: Date | null; firstAccessCompleted?: boolean } | null | undefined): boolean {
  return Boolean(user && (user.emailVerified || user.firstAccessCompleted));
}
