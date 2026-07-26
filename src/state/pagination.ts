export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  return items.slice(page * pageSize, (page + 1) * pageSize);
}
