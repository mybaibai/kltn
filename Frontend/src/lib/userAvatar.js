import defaultAvatar from '@/assets/default.jpg';

export const DEFAULT_USER_AVATAR = defaultAvatar;

/**
 * URL ảnh đại diện: dùng ảnh user nếu có, không thì `default.jpg`.
 * Hỗ trợ nhiều shape (user document, victim embed, v.v.).
 */
export function getUserAvatarSrc(entity) {
  if (!entity) return defaultAvatar;
  const url =
    entity.profile?.avatar_url ||
    entity.profile?.avatar ||
    entity.avatar_url ||
    entity.avatar;
  const s = url != null ? String(url).trim() : '';
  return s || defaultAvatar;
}
