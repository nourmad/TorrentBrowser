import express from 'express';
import WebTorrent from 'webtorrent';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize WebTorrent client
const client = new WebTorrent();

// Middleware
app.use(express.json());

// Serve static files from client/build in production and client/public in development
if (process.env.NODE_ENV === 'production') {
  // Serve static assets in production
  app.use(express.static(path.join(__dirname, 'client/build')));
} else {
  // Development - serve from public folder
  app.use(express.static(path.join(__dirname, 'client/public')));
  app.use('/client', express.static(path.join(__dirname, 'client/public')));
}

// Serve main index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint to handle magnet links
app.post('/api/torrent', (req, res) => {
  const { magnetLink } = req.body;
  
  if (!magnetLink) {
    return res.status(400).json({ error: 'Magnet link is required' });
  }

  // Check if torrent is already being downloaded
  const existingTorrent = client.torrents.find(t => t.magnetURI === magnetLink);
  
  if (existingTorrent) {
    return res.json({ 
      infoHash: existingTorrent.infoHash,
      files: existingTorrent.files.map(file => ({
        name: file.name,
        length: file.length,
        path: `/stream/${existingTorrent.infoHash}/${encodeURIComponent(file.path)}`
      })),
      progress: existingTorrent.progress
    });
  }

  try {
    // Add the torrent
    client.add(magnetLink, { 
      // Increase timeout for better performance with slow trackers
      maxWebConns: 10,
      strategy: 'sequential'
    }, (torrent) => {
      // Send back torrent info
      res.json({
        infoHash: torrent.infoHash,
        files: torrent.files.map(file => ({
          name: file.name,
          length: file.length,
          path: `/stream/${torrent.infoHash}/${encodeURIComponent(file.path)}`
        })),
        progress: torrent.progress
      });

      // Log when download completes
      torrent.on('done', () => {
        console.log('Torrent download finished');
      });

      // Log download progress
      torrent.on('download', () => {
        console.log(`Progress: ${(torrent.progress * 100).toFixed(1)}%`);
      });
    });
  } catch (error) {
    console.error('Error adding torrent:', error.message);
    return res.status(500).json({ error: `Failed to process magnet link: ${error.message}` });
  }

  // Handle client errors
  client.on('error', err => {
    console.error('WebTorrent client error:', err.message);
  });
});

// Stream endpoint
app.get('/stream/:infoHash/:filePath', (req, res) => {
  const { infoHash, filePath } = req.params;
  const torrent = client.torrents.find(t => t.infoHash === infoHash);
  
  if (!torrent) {
    return res.status(404).send('Torrent not found');
  }

  const decodedPath = decodeURIComponent(filePath);
  const file = torrent.files.find(f => f.path === decodedPath);
  
  if (!file) {
    return res.status(404).send('File not found');
  }

  // Get file MIME type
  const mimeType = getMimeType(file.name);
  res.setHeader('Content-Type', mimeType);

  // Handle range requests for video streaming
  const range = req.headers.range;
  if (range) {
    const positions = range.replace(/bytes=/, '').split('-');
    const start = parseInt(positions[0], 10);
    const fileSize = file.length;
    const end = positions[1] ? parseInt(positions[1], 10) : fileSize - 1;
    const chunkSize = (end - start) + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': mimeType
    });

    const stream = file.createReadStream({ start, end });
    stream.pipe(res);
  } else {
    res.setHeader('Content-Length', file.length);
    file.createReadStream().pipe(res);
  }
});

// Helper function to determine MIME type
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const types = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain'
  };
  
  return types[ext] || 'application/octet-stream';
}

// Always serve the React app for client-side routing
app.get('*', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
  } else {
    res.sendFile(path.resolve(__dirname, 'client', 'public', 'index.html'));
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 