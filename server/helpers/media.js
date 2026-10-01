const { cloudinary, DELIVERY_TYPE, FOLDER, assertConfigured } = require('./cloudinary');

const MAX_MEDIA_PER_POST = 10;
const RESOURCE_TYPES = ['image', 'video'];

// Video diproses ulang di Cloudinary (lebar maks 720px, kualitas otomatis) agar ringan diputar di HP.
const VIDEO_EAGER = 'c_limit,w_720,q_auto/mp4';

const userFolder = (userId) => `${FOLDER}/posts/u${userId}`;

// Parameter upload yang ditandatangani server. Browser mengunggah langsung ke Cloudinary
// dengan parameter ini, jadi file besar tidak lewat server kita.
function createUploadSignature(userId, resourceType) {
  assertConfigured();
  if (!RESOURCE_TYPES.includes(resourceType)) throw { name: 'BadRequest', message: 'Jenis file tidak didukung' };

  const params = {
    timestamp: Math.round(Date.now() / 1000),
    folder: userFolder(userId),
    type: DELIVERY_TYPE,
  };
  if (resourceType === 'video') Object.assign(params, { eager: VIDEO_EAGER, eager_async: true });

  const { cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret } = cloudinary.config();
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    params: { ...params, api_key: apiKey, signature: cloudinary.utils.api_sign_request(params, apiSecret) },
  };
}

// Pastikan media yang dilampirkan benar-benar hasil upload ke akun kita, oleh user ini.
function validateUploadedMedia(userId, media) {
  if (!Array.isArray(media)) throw { name: 'BadRequest', message: 'Data media tidak valid' };
  if (media.length > MAX_MEDIA_PER_POST) {
    throw { name: 'BadRequest', message: `Maksimal ${MAX_MEDIA_PER_POST} foto/video per postingan` };
  }

  return media.map((m, position) => {
    const publicId = String(m.publicId ?? '');
    const valid =
      RESOURCE_TYPES.includes(m.resourceType) &&
      publicId.startsWith(`${userFolder(userId)}/`) &&
      cloudinary.utils.verify_api_response_signature(publicId, m.version, m.signature);
    if (!valid) throw { name: 'BadRequest', message: 'Ada file yang tidak valid, silakan upload ulang' };

    return {
      type: m.resourceType,
      publicId,
      width: Number(m.width) || null,
      height: Number(m.height) || null,
      duration: m.resourceType === 'video' ? Number(m.duration) || null : null,
      position,
    };
  });
}

// URL bertanda tangan untuk ditampilkan ke user yang berhak.
function deliveryUrls(media) {
  const base = { type: DELIVERY_TYPE, sign_url: true, secure: true };
  if (media.type === 'image') {
    return {
      url: cloudinary.url(media.publicId, {
        ...base,
        transformation: [{ crop: 'limit', width: 1080, quality: 'auto', fetch_format: 'auto' }],
      }),
    };
  }
  const video = { ...base, resource_type: 'video' };
  return {
    url: cloudinary.url(media.publicId, { ...video, raw_transformation: VIDEO_EAGER.replace('/mp4', ''), format: 'mp4' }),
    // Cadangan jika versi yang diproses ulang belum siap.
    originalUrl: cloudinary.url(media.publicId, video),
    posterUrl: cloudinary.url(media.publicId, {
      ...video,
      format: 'jpg',
      transformation: [{ crop: 'limit', width: 720, start_offset: 0 }],
    }),
  };
}

async function deleteFromCloudinary(mediaList) {
  for (const resourceType of RESOURCE_TYPES) {
    const ids = mediaList.filter((m) => m.type === resourceType).map((m) => m.publicId);
    if (ids.length) {
      await cloudinary.api.delete_resources(ids, { type: DELIVERY_TYPE, resource_type: resourceType, invalidate: true });
    }
  }
}

module.exports = { MAX_MEDIA_PER_POST, createUploadSignature, validateUploadedMedia, deliveryUrls, deleteFromCloudinary };
