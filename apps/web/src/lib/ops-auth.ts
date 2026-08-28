/** Whether an Ops user must complete the forced password replacement flow. */
export function requiresForcedPasswordChange(user: {
  mustChangePassword?: boolean | null;
}): boolean {
  return user.mustChangePassword === true;
}

/** Post-login destination for Ops users. */
export function opsLoginDestination(user: {
  mustChangePassword?: boolean | null;
}): '/auth/change-password' | '/dashboard' {
  return requiresForcedPasswordChange(user) ? '/auth/change-password' : '/dashboard';
}

/** Navigation target after a successful Ops login mutation. */
export function resolveOpsPostLoginNavigation(user: {
  mustChangePassword?: boolean | null;
}): { to: '/auth/change-password' | '/dashboard'; replace: true } {
  return { to: opsLoginDestination(user), replace: true };
}
