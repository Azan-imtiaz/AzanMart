const sharp = require("sharp");

// Shrinks uploads to a sensible size and converts them to WebP. Decoding the
// file also proves it really is an image, whatever its declared type says.
async function optimizeImage(buffer) {
  const data = await sharp(buffer)
    .rotate() // respect the camera's orientation before EXIF data is dropped
    .resize({ width: 1000, height: 1000, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  return { data, contentType: "image/webp" };
}

module.exports = { optimizeImage };
