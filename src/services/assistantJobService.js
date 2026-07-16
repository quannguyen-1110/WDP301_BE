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
  const resp = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(resp.data);
};

const clampRegion = (region, imgWidth, imgHeight) => {
  const x = Math.max(0, Math.floor(region.x));
  const y = Math.max(0, Math.floor(region.y));
  const width = Math.min(imgWidth - x, Math.floor(region.width));
  const height = Math.min(imgHeight - y, Math.floor(region.height));
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
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

      const left = Math.min(...clamped.map(r => r.x));
      const top = Math.min(...clamped.map(r => r.y));
      const right = Math.max(...clamped.map(r => r.x + r.width));
      const bottom = Math.max(...clamped.map(r => r.y + r.height));

      const unionW = right - left;
      const unionH = bottom - top;

      // Create transparent canvas
      const base = sharp({ create: { width: unionW, height: unionH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });

      // Composite each region
      const composites = await Promise.all(
        clamped.map(async (r) => {
          const regionBuf = await sharp(srcBuffer).extract({
            left: r.x,
            top: r.y,
            width: r.width,
            height: r.height,
          }).png().toBuffer();

          return {
            input: regionBuf,
            left: r.x - left,
            top: r.y - top,
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

