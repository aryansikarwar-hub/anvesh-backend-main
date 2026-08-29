const DIACRITICS = /[\u0300-\u036f]/g;

export function slugify(input: string, maxLength = 80): string {
  const base = input
    .normalize('NFKD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.slice(0, maxLength).replace(/-+$/g, '');
}

export function uniqueSlug(input: string, suffix: string): string {
  const base = slugify(input, 72);
  return base ? `${base}-${suffix}` : suffix;
}
