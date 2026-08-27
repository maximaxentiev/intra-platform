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
