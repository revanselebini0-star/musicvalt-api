export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { q, id } = req.query;

  // Daftar instance Piped API cadangan jika yang utama down
  const PIPED_INSTANCES = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.leptons.xyz",
    "https://piped-api.privacy.com.de"
  ];

  let searchData = null;
  let streamData = null;

  try {
    // FITUR 1: Pencarian Lagu
    if (q) {
      const searchQuery = `${q} Topic Official Audio`;
      
      // Coba beberapa instance sampai berhasil
      for (const instance of PIPED_INSTANCES) {
        try {
          const searchRes = await fetch(`${instance}/search?q=${encodeURIComponent(searchQuery)}&filter=music_songs`);
          const textResponse = await searchRes.text();
          
          // Pastikan response berupa JSON yang valid (bukan HTML error/Cloudflare)
          if (textResponse.startsWith('{') || textResponse.startsWith('[')) {
            searchData = JSON.parse(textResponse);
            break; // Berhasil, keluar dari loop
          }
        } catch (err) {
          continue; // Coba instance berikutnya jika gagal
        }
      }

      if (!searchData) {
        return res.status(500).json({ error: "Gagal mengambil data dari server musik. Coba lagi nanti." });
      }

      const officialTracks = (searchData.items || [])
        .filter(item => item.type === 'stream')
        .map(item => {
          const cleanArtist = item.uploaderName ? item.uploaderName.replace(' - Topic', '') : 'Unknown Artist';
          return {
            id: item.url ? item.url.replace('/watch?v=', '') : '',
            title: item.title || 'Unknown Title',
            artist: cleanArtist,
            thumbnail: item.thumbnail || '',
            duration: item.duration || 0,
            isOfficial: item.uploaderName?.includes('Topic') || item.uploaderVerified
          };
        });

      return res.status(200).json(officialTracks);
    }

    // FITUR 2: Ambil Direct Audio Stream & Cover HD
    if (id) {
      for (const instance of PIPED_INSTANCES) {
        try {
          const streamRes = await fetch(`${instance}/streams/${id}`);
          const textResponse = await streamRes.text();

          if (textResponse.startsWith('{') || textResponse.startsWith('[')) {
            streamData = JSON.parse(textResponse);
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
      const bestAudio = audioStreams.find(s => s.mimeType?.includes('audio/mp4')) || audioStreams[0];

      return res.status(200).json({
        id: id,
        title: streamData.title || '',
        artist: streamData.uploader ? streamData.uploader.replace(' - Topic', '') : '',
        coverUrl: streamData.thumbnailUrl || '',
        duration: streamData.duration || 0,
        audioUrl: bestAudio ? bestAudio.url : null
      });
    }

    return res.status(400).json({ error: "Gunakan parameter ?q= untuk mencari atau ?id= untuk memutar lagu." });

  } catch (error) {
    return res.status(500).json({ error: "Terjadi kesalahan internal: " + error.message });
  }
}
