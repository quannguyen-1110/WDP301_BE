/**
 * Normalize a URL to an absolute URL with protocol and host.
 * If the URL is already absolute (starts with http://, https://, data:), returns as-is.
 * If the URL is relative (e.g. /uploads/file.png, uploads/file.png, src/uploads/file.png),
 * it will be converted to an absolute URL using the request context.
 *
 * @param {string} url - The raw URL to normalize
 * @param {object} req - Express request object (used to get protocol + host)
 * @returns {string} - Normalized absolute URL
 */
function normalizeUrl(url, req) {
  if (!url) return '';

  // Already absolute - return as-is
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }

  // Build base URL from request
  const protocol = req?.protocol || 'http';
  const host = req?.get?.('host') || 'localhost:3000';
  const base = `${protocol}://${host}`;

  // Handle various relative path formats:
  // 1. "/uploads/file.png" or "/src/uploads/file.png"
  // 2. "uploads/file.png" or "src/uploads/file.png"
  // 3. Windows-style "src\\uploads\\file.png"

  let normalized = url.replace(/\\/g, '/'); // Normalize backslashes

  // Strip leading "src/" or "./src/" or "../" prefixes
  normalized = normalized.replace(/^(\.\/)?src\//, '');
  normalized = normalized.replace(/^\.\.\//, '');

  // Ensure it starts with /uploads/
  if (!normalized.startsWith('/uploads/') && !normalized.startsWith('uploads/')) {
    // If it's just a filename, prepend /uploads/
    if (!normalized.includes('/')) {
      normalized = `uploads/${normalized}`;
    }
  }

  // Ensure leading slash
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }

  return `${base}${normalized}`;
}

/**
 * Normalize all image URLs in a page object.
 *
 * @param {object} page - Page document (Mongoose or plain object)
 * @param {object} req - Express request object
 * @returns {object} - Page with normalized URLs
 */
function normalizePageImageUrls(page, req) {
  if (!page) return page;

  const pageObj = page.toObject ? page.toObject() : { ...page };

  if (pageObj.imageUrl) {
    pageObj.imageUrl = normalizeUrl(pageObj.imageUrl, req);
  }
  if (pageObj.assistantImageUrl) {
    pageObj.assistantImageUrl = normalizeUrl(pageObj.assistantImageUrl, req);
  }

  // Also normalize any resources URLs
  if (pageObj.resources && Array.isArray(pageObj.resources)) {
    pageObj.resources = pageObj.resources.map((res) => ({
      ...res,
      url: res.url ? normalizeUrl(res.url, req) : res.url,
    }));
  }

  return pageObj;
}

module.exports = {
  normalizeUrl,
  normalizePageImageUrls,
};

