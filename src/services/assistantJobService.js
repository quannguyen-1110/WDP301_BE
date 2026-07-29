const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { cloudinary } = require('../config/cloudinary');

const sanitizePublicId = (name) => {
  const base = String(name || 'result')
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  return base;
};

/**
 * Upload a Buffer to Cloudinary as an image.
 */
const uploadBufferToCloudinary = async ({ buffer, publicId, folder }) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder: folder || 'mangaka_uploads',
        public_id: publicId,
        resource_type: 'image',
        overwrite: true,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    ).end(buffer);
  });
};

const downloadImageToBuffer = async (url) => {
  if (url.startsWith('http')) {
    const resp = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(resp.data);
  } else {
    // Relative path. E.g. "/uploads/filename.png" or "uploads/filename.png"
    const filename = path.basename(url);
    const localPath = path.join(process.cwd(), 'src', 'uploads', filename);
    if (!fs.existsSync(localPath)) {
      throw new Error(`Local file not found at ${localPath}`);
    }
    return fs.readFileSync(localPath);
  }
};

const clampRegion = (region, imgWidth, imgHeight) => {
  const pctX = region.x ?? 0;
  const pctY = region.y ?? 0;
  const pctW = region.width ?? 0;
  const pctH = region.height ?? 0;

  const left = Math.max(0, Math.floor((pctX / 100) * imgWidth));
  const top = Math.max(0, Math.floor((pctY / 100) * imgHeight));
  const width = Math.max(1, Math.min(imgWidth - left, Math.floor((pctW / 100) * imgWidth)));
  const height = Math.max(1, Math.min(imgHeight - top, Math.floor((pctH / 100) * imgHeight)));

  return { left, top, width, height };
};

/**
 * Crop an image by each region in the task.
 * Returns: assistantImageUrl (public URL) for each region.
 */
exports.generateAssistantPageArt = async ({ task, pages, regionType = 'regions' }) => {
  // task.regions = [ {x,y,width,height,...}, ... ]
  const regions = task?.[regionType] || [];
  if (!Array.isArray(regions) || regions.length === 0) {
    throw new Error('Task regions is empty');
  }

  const resultsByPageId = {};

  for (const page of pages) {
    if (!page?.imageUrl) {
      throw new Error(`Missing imageUrl for page ${page._id}`);
    }

    // Download source page image
    const srcBuffer = await downloadImageToBuffer(page.imageUrl);

    const meta = await sharp(srcBuffer).metadata();
    const imgWidth = meta.width;
    const imgHeight = meta.height;
    if (!imgWidth || !imgHeight) {
      throw new Error(`Cannot determine image dimensions for page ${page._id}`);
    }

    // For now: if multiple regions exist, merge them into one canvas (simple approach)
    // We will create a new image with same region bounds (union) and composite.
    // But for performance and simplicity, if there is exactly 1 region => crop.

    let outputBuffer;

    if (regions.length === 1) {
      const r = clampRegion(regions[0], imgWidth, imgHeight);
      if (!r) throw new Error(`Invalid region for page ${page._id}`);
      outputBuffer = await sharp(srcBuffer)
        .extract(r)
        .png()
        .toBuffer();
    } else {
      // Union bounds
      const clamped = regions
        .map((r) => clampRegion(r, imgWidth, imgHeight))
        .filter(Boolean);
      if (clamped.length === 0) throw new Error(`Invalid regions for page ${page._id}`);

      const left = Math.min(...clamped.map(r => r.left));
      const top = Math.min(...clamped.map(r => r.top));
      const right = Math.max(...clamped.map(r => r.left + r.width));
      const bottom = Math.max(...clamped.map(r => r.top + r.height));

      const unionW = right - left;
      const unionH = bottom - top;

      // Create transparent canvas
      const base = sharp({ create: { width: unionW, height: unionH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });

      // Composite each region
      const composites = await Promise.all(
        clamped.map(async (r) => {
          const regionBuf = await sharp(srcBuffer).extract({
            left: r.left,
            top: r.top,
            width: r.width,
            height: r.height,
          }).png().toBuffer();

          return {
            input: regionBuf,
            left: r.left - left,
            top: r.top - top,
          };
        })
      );

      outputBuffer = await base
        .composite(composites)
        .png()
        .toBuffer();
    }

    // Upload to Cloudinary
    const publicId = sanitizePublicId(`assistant_task_${task._id}_page_${page._id}`) + `_${Date.now()}`;

    const folder = 'assistant_results';
    const uploaded = await uploadBufferToCloudinary({
      buffer: outputBuffer,
      publicId,
      folder,
    });

    resultsByPageId[String(page._id)] = uploaded.secure_url;
  }

  return resultsByPageId;
};

