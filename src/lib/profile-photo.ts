import "server-only";
import sharp from "sharp";

export async function normalizeProfilePhoto(photo: File) {
  if (photo.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(photo.type)) {
    throw new Error("Profile photos must be JPEG, PNG, or WebP and no larger than 2 MB.");
  }
  try {
    const input = Buffer.from(await photo.arrayBuffer());
    const image = sharp(input, { limitInputPixels: 25_000_000, animated: false });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? "")) throw new Error("Unsupported image");
    return await image.rotate().resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  } catch {
    throw new Error("This photo could not be read. Choose a valid JPEG, PNG, or WebP image up to 25 megapixels.");
  }
}
