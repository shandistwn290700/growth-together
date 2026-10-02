const { cloudinary, DELIVERY_TYPE, FOLDER, assertConfigured } = require('./cloudinary');

const MAX_MEDIA_PER_POST = 10;
const RESOURCE_TYPES = ['image', 'video'];

// Kegunaan upload menentukan folder di Cloudinary dan jenis file yang boleh.
const PURPOSES = {
  post: { folder: 'posts', resourceTypes: ['image', 'video'] },
  avatar: { folder: 'avatars', resourceTypes: ['image'] },
};

// Video diproses ulang di Cloudinary (lebar maks 720px, kualitas otomatis) agar ringan diputar di HP.
const VIDEO_EAGER = 'c_limit,w_720,q_auto/mp4';

function purposeOf(name) {
  const purpose = PURPOSES[name ?? 'post'];
  if (!purpose) throw { name: 'BadRequest', message: 'Tujuan upload tidak valid' };
  return purpose;
}

const userFolder = (userId, purpose) => `${FOLDER}/${purpose.folder}/u${userId}`;

// Parameter upload yang ditandatangani server. Browser mengunggah langsung ke Cloudinary
// dengan parameter ini, jadi file besar tidak lewat server kita.
function createUploadSignature(userId, resourceType, purposeName) {
  assertConfigured();
  const purpose = purposeOf(purposeName);
  if (!purpose.resourceTypes.includes(resourceType)) throw { name: 'BadRequest', message: 'Jenis file tidak didukung' };

  const params = {
    timestamp: Math.round(Date.now() / 1000),
    folder: userFolder(userId, purpose),
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
function validateUploadedMedia(userId, media, purposeName) {
  const purpose = purposeOf(purposeName);
  if (!Array.isArray(media)) throw { name: 'BadRequest', message: 'Data media tidak valid' };
  if (media.length > MAX_MEDIA_PER_POST) {
    throw { name: 'BadRequest', message: `Maksimal ${MAX_MEDIA_PER_POST} foto/video per postingan` };
  }

  return media.map((m, position) => {
    const publicId = String(m?.publicId ?? '');
    const valid =
      purpose.resourceTypes.includes(m?.resourceType) &&
      publicId.startsWith(`${userFolder(userId, purpose)}/`) &&
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

const signedBase = { type: DELIVERY_TYPE, sign_url: true, secure: true };

// URL bertanda tangan untuk ditampilkan ke user yang berhak.
function deliveryUrls(media) {
  if (media.type === 'image') {
    return {
      url: cloudinary.url(media.publicId, {
        ...signedBase,
        transformation: [{ crop: 'limit', width: 1080, quality: 'auto', fetch_format: 'auto' }],
      }),
      thumbUrl: cloudinary.url(media.publicId, {
        ...signedBase,
        transformation: [{ crop: 'fill', width: 400, height: 400, quality: 'auto', fetch_format: 'auto' }],
      }),
    };
  }
  const video = { ...signedBase, resource_type: 'video' };
  const posterUrl = cloudinary.url(media.publicId, {
    ...video,
    format: 'jpg',
    transformation: [{ crop: 'limit', width: 720, start_offset: 0 }],
  });
  return {
    url: cloudinary.url(media.publicId, { ...video, raw_transformation: VIDEO_EAGER.replace('/mp4', ''), format: 'mp4' }),
    // Cadangan jika versi yang diproses ulang belum siap.
    originalUrl: cloudinary.url(media.publicId, video),
    posterUrl,
    thumbUrl: cloudinary.url(media.publicId, {
      ...video,
      format: 'jpg',
      transformation: [{ crop: 'fill', width: 400, height: 400, start_offset: 0 }],
    }),
  };
}

// Foto profil: dipotong persegi dengan fokus ke wajah.
function photoUrl(publicId) {
  if (!publicId) return null;
  return cloudinary.url(publicId, {
    ...signedBase,
    transformation: [{ crop: 'fill', gravity: 'face', width: 320, height: 320, quality: 'auto', fetch_format: 'auto' }],
  });
}

// Versi arsip untuk laporan ZIP: JPG, lebar maks 2000px (cukup tajam untuk dicetak, ukuran tetap wajar).
function archiveImageUrl(publicId) {
  return cloudinary.url(publicId, {
    ...signedBase,
    transformation: [{ crop: 'limit', width: 2000, quality: 'auto:good', fetch_format: 'jpg' }],
  });
}

async function deleteFromCloudinary(mediaList) {
  for (const resourceType of RESOURCE_TYPES) {
    const ids = mediaList.filter((m) => m.type === resourceType).map((m) => m.publicId);
    if (ids.length) {
      await cloudinary.api.delete_resources(ids, { type: DELIVERY_TYPE, resource_type: resourceType, invalidate: true });
    }
  }
}

module.exports = {
  MAX_MEDIA_PER_POST,
  createUploadSignature,
  validateUploadedMedia,
  deliveryUrls,
  archiveImageUrl,
  photoUrl,
  deleteFromCloudinary,
};
