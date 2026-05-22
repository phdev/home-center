const PARTITIONS = [25, 26, 27, 28, 29, 30, 47, 48, 49, 50, 51, 52];

async function tryPartition(token, partition, corsProxy) {
  const baseUrl = `https://p${partition}-sharedstreams.icloud.com/${token}/sharedstreams`;
  const streamUrl = corsProxy
    ? `${corsProxy}${encodeURIComponent(`${baseUrl}/webstream`)}`
    : `${baseUrl}/webstream`;

  const res = await fetch(streamUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ streamCtag: null }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  if (!data.photos) return null;
  return { data, baseUrl };
}

async function getAssetUrls(checksums, baseUrl, corsProxy) {
  const assetUrl = corsProxy
    ? `${corsProxy}${encodeURIComponent(`${baseUrl}/webasseturls`)}`
    : `${baseUrl}/webasseturls`;

  const res = await fetch(assetUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ photoGuids: checksums }),
  });

  if (!res.ok) return {};
  const data = await res.json();
  return data.items || {};
}

function pickBestDerivative(derivatives) {
  let best = null;
  let bestSize = 0;
  for (const key of Object.keys(derivatives)) {
    const d = derivatives[key];
    const size = (d.width || 0) * (d.height || 0);
    if (size > bestSize && size <= 2000 * 2000) {
      best = d;
      bestSize = size;
    }
  }
  return best || Object.values(derivatives)[0];
}

export async function fetchPhotosFromAlbum(albumToken, corsProxy) {
  if (!albumToken) return [];

  let streamData = null;
  let baseUrl = null;

  for (const p of PARTITIONS) {
    try {
      const result = await tryPartition(albumToken, p, corsProxy);
      if (result) {
        streamData = result.data;
        baseUrl = result.baseUrl;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!streamData || !streamData.photos) return [];

  const photos = streamData.photos.slice(0, 20);
  const guids = photos.map((p) => p.photoGuid);

  let assetUrls;
  try {
    assetUrls = await getAssetUrls(guids, baseUrl, corsProxy);
  } catch {
    return [];
  }

  const result = [];
  for (const photo of photos) {
    const derivatives = photo.derivatives || {};
    const best = pickBestDerivative(derivatives);
    if (!best || !best.checksum) continue;

    const asset = assetUrls[best.checksum];
    if (!asset) continue;

    const url = `https://${asset.url_location}${asset.url_path}`;
    result.push({
      url,
      cap: photo.caption || "",
    });
  }

  return result;
}
