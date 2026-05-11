/**
 * Danh sách số trang + ellipsis cho UI dạng: < 1 2 3 4 ... 17 >
 * @param {number} currentPage — trang hiện tại (bắt đầu từ 1)
 * @param {number} totalPages
 * @returns {(number | 'ellipsis')[]}
 */
export function getAdminPaginationItems(currentPage, totalPages) {
  const total = Math.max(0, Math.floor(Number(totalPages) || 0));
  const current = Math.min(Math.max(1, Math.floor(Number(currentPage) || 1)), Math.max(1, total));
  if (total < 1) return [];
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const last = total;
  if (current <= 4) {
    return [1, 2, 3, 4, 'ellipsis', last];
  }
  if (current >= last - 3) {
    return [1, 'ellipsis', last - 3, last - 2, last - 1, last];
  }
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', last];
}
