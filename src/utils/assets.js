export function assetUrl(path) {
    const cleanPath = String(path || '').replace(/^\/+/, '');
    const baseUrl = new URL(import.meta.env.BASE_URL, window.location.href);
    return new URL(cleanPath, baseUrl).toString();
}
