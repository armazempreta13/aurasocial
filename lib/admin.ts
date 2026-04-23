export const ADMIN_EMAIL = 'philippeboechat1@gmail.com';
export const ADMIN_UID = 'Xg1kUDYzAvQ91rChJE1NhXxSV5I3';

export function isAdmin(user: { email: string | null; uid: string } | null | undefined) {
  if (!user) return false;
  return user.email === ADMIN_EMAIL || user.uid === ADMIN_UID;
}
