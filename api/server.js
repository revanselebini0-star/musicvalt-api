export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { q, id } = req.query;

  try {
    const PIPED_API = "https://pipedapi.kavin.rocks";

    // FITUR 1: Pencarian lagu resmi dari YouTube Music (?q=judul_lagu)
    if (q) {
      // Menambahkan keyword agar memprioritaskan rilisan resmi (Topic)
      const searchQuery = `${q} Topic Official Audio`;
      const searchRes = await fetch(`${PIPED_API}/search?q=${encodeURIComponent(searchQuery)}&filter=music_songs`);
      const searchData = await searchRes.json();

      const officialTracks = (searchData.items || [])
        .filter(item => item.type === 'stream')
        .map(item => {
          // Membersihkan string " - Topic" pada nama artist
          const cleanArtist = item.uploaderName ? item.uploaderName.replace(' - Topic', '') : 'Unknown Artist';
          
          return {
            id: item.url.replace('/watch?v=', ''),
            title: item.title,
            artist: cleanArtist,
            thumbnail: item.thumbnail,
            duration: item.duration,
            isOfficial: item.uploaderName?.includes('Topic') || item.uploaderVerified
          };
        });

      return res.status(200).json(officialTracks);
    }

    // FITUR 2: Ambil Direct Audio Stream Full & Cover HD (?id=video_id)
    if (id) {
      const streamRes = await fetch(`${PIPED_API}/streams/${id}`);
      const streamData = await streamRes.json();
      
      const audioStreams = streamData.audioStreams || [];
      const bestAudio = audioStreams.find(s => s.mimeType?.includes('audio/mp4')) || audioStreams[0];

      return res.status(200).json({
        id: id,
        title: streamData.title,
        artist: streamData.uploader ? streamData.uploader.replace(' - Topic', '') : '',
        coverUrl: streamData.thumbnailUrl,
        duration: streamData.duration,
        audioUrl: bestAudio ? bestAudio.url : null
      });
    }

    return res.status(400).json({ error: "Gunakan parameter ?q= untuk mencari atau ?id= untuk memutar lagu." });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
