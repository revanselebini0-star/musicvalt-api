export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { q, id } = req.query;

  // Daftar instance publik Piped & Invidious cadangan
  const API_INSTANCES = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.leptons.xyz",
    "https://piped-api.privacy.com.de",
    "https://invidious.privacydev.net"
  ];

  let searchData = null;
  let streamData = null;

  try {
    // FITUR 1: Pencarian Lagu
    if (q) {
      const searchQuery = `${q} Topic Official Audio`;
      
      for (const instance of API_INSTANCES) {
        try {
          const searchUrl = `${instance}/search?q=${encodeURIComponent(searchQuery)}`;
          const searchRes = await fetch(searchUrl);
          const textResponse = await searchRes.text();
          
          if (textResponse.startsWith('{') || textResponse.startsWith('[')) {
            const parsed = JSON.parse(textResponse);
            
            // Penyesuaian format jika menggunakan Invidious
            if (instance.includes('invidious')) {
              searchData = parsed.map(item => ({
                type: item.type === 'video' ? 'stream' : item.type,
                url: `/watch?v=${item.videoId}`,
                title: item.title,
                uploaderName: item.author,
                thumbnail: item.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
                duration: item.lengthSeconds,
                uploaderVerified: item.authorVerified
              }));
            } else {
              searchData = parsed.items || [];
            }
            break;
          }
        } catch (err) {
          continue;
        }
      }

      if (!searchData) {
        return res.status(500).json({ error: "Gagal mengambil data dari server musik. Semua instance sedang sibuk." });
      }

      const officialTracks = searchData
        .filter(item => item.type === 'stream')
        .map(item => {
          const cleanArtist = item.uploaderName ? item.uploaderName.replace(' - Topic', '') : 'Unknown Artist';
          const cleanId = item.url ? item.url.replace('/watch?v=', '').replace('/watch?v=', '') : '';
          
          return {
            id: cleanId,
            title: item.title || 'Unknown Title',
            artist: cleanArtist,
            thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg`,
            duration: item.duration || 0,
            isOfficial: item.uploaderName?.includes('Topic') || item.uploaderVerified
          };
        });

      return res.status(200).json(officialTracks);
    }

    // FITUR 2: Ambil Direct Audio Stream & Cover HD
    if (id) {
      for (const instance of API_INSTANCES) {
        try {
          const streamUrl = instance.includes('invidious') 
            ? `${instance}/api/v1/videos/${id}` 
            : `${instance}/streams/${id}`;
            
          const streamRes = await fetch(streamUrl);
          const textResponse = await streamRes.text();

          if (textResponse.startsWith('{') || textResponse.startsWith('[')) {
            const parsed = JSON.parse(textResponse);
            
            if (instance.includes('invidious')) {
              const adaptiveFormats = parsed.adaptiveFormats || [];
              const bestAudio = adaptiveFormats.filter(f => f.type?.includes('audio')).pop() || {};
              streamData = {
                title: parsed.title,
                uploader: parsed.author,
                thumbnailUrl: parsed.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
                duration: parsed.lengthSeconds,
                audioStreams: [{ url: bestAudio.url, mimeType: bestAudio.type }]
              };
            } else {
              streamData = parsed;
            }
            break;
          }
        } catch (err) {
          continue;
        }
      }

      if (!streamData) {
        return res.status(500).json({ error: "Gagal mengambil stream audio." });
      }

      const audioStreams = streamData.audioStreams || [];
      const bestAudio = audioStreams.find(s => s.mimeType?.includes('audio/mp4') || s.mimeType?.includes('audio')) || audioStreams[0];

      return res.status(200).json({
        id: id,
        title: streamData.title || '',
        artist: streamData.uploader ? streamData.uploader.replace(' - Topic', '') : '',
        coverUrl: streamData.thumbnailUrl || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        duration: streamData.duration || 0,
        audioUrl: bestAudio ? bestAudio.url : null
      });
    }

    return res.status(400).json({ error: "Gunakan parameter ?q= untuk mencari atau ?id= untuk memutar lagu." });

  } catch (error) {
    return res.status(500).json({ error: "Terjadi kesalahan internal: " + error.message });
  }
}
