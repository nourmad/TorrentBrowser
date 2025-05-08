import express from 'express';
import WebTorrent from 'webtorrent';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize WebTorrent client with memory-only cache
const client = new WebTorrent({
  // Disable storage to prevent writing files to disk
  store: (chunkLength, storeOpts) => {
    // Create a memory-only store
    const chunks = {};
    return {
      put: (index, buf, cb) => {
        chunks[index] = Buffer.from(buf);
        cb(null);
      },
      get: (index, cb) => {
        const chunk = chunks[index] || null;
        cb(null, chunk);
      },
      close: cb => { cb(null) }
    };
  }
});

// Configure streaming settings
const STREAM_CACHE_SIZE = 350 * 1024 * 1024; // Cache approximately 350MB of video
const PIECE_BUFFER_SIZE = 50; // Number of pieces to prioritize ahead of playback
const MAX_CONNECTIONS = 40; // Increase connections for better streaming
const MIN_PEERS = 10; // Minimum peer connections before we start playing

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

// API status endpoint for health checking
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'online',
    torrents: client.torrents.length,
    systemMemory: process.memoryUsage()
  });
});

// API endpoint to handle magnet links
app.post('/api/torrent', (req, res) => {
  const { magnetLink } = req.body;
  
  if (!magnetLink) {
    return res.status(400).json({ error: 'Magnet link is required' });
  }

  // Check if torrent is already being streamed
  const existingTorrent = client.torrents.find(t => t.magnetURI === magnetLink);
  
  if (existingTorrent) {
    return res.json({ 
      infoHash: existingTorrent.infoHash,
      files: existingTorrent.files.map(file => ({
        name: file.name,
        length: file.length,
        path: `/stream/${existingTorrent.infoHash}/${encodeURIComponent(file.path)}`
      })),
      progress: existingTorrent.progress,
      streamingOnly: true,
      peers: existingTorrent.numPeers,
      downloadSpeed: existingTorrent.downloadSpeed,
      timeRemaining: existingTorrent.timeRemaining
    });
  }

  try {
    // Add the torrent with streaming options
    client.add(magnetLink, { 
      maxWebConns: MAX_CONNECTIONS, // Increase connections for better streaming
      strategy: 'sequential',       // Sequential download for streaming
      streamingOnly: true           // Custom flag for our app
    }, (torrent) => {
      // Manage the torrent pieces to prioritize current viewing position
      torrent.on('download', () => {
        // Log download progress
        console.log(`Streaming progress: ${(torrent.progress * 100).toFixed(1)}%, Speed: ${formatBytes(torrent.downloadSpeed)}/s, Peers: ${torrent.numPeers}`);
      });

      // Setup wire (peer) connection handlers
      torrent.on('wire', (wire) => {
        console.log(`Connected to peer with address: ${wire.remoteAddress}`);
        wire.setTimeout(30000); // 30 second timeout
        wire.on('timeout', () => {
          console.log('Peer timed out');
          wire.destroy();
        });
      });

      // Send back torrent info
      res.json({
        infoHash: torrent.infoHash,
        files: torrent.files.map(file => ({
          name: file.name,
          length: file.length,
          path: `/stream/${torrent.infoHash}/${encodeURIComponent(file.path)}`
        })),
        progress: torrent.progress,
        streamingOnly: true,
        peers: torrent.numPeers,
        downloadSpeed: torrent.downloadSpeed,
        timeRemaining: torrent.timeRemaining
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

// Get torrent status update endpoint
app.get('/api/torrent/:infoHash/status', (req, res) => {
  const { infoHash } = req.params;
  const torrent = client.torrents.find(t => t.infoHash === infoHash);
  
  if (!torrent) {
    return res.status(404).json({ error: 'Torrent not found' });
  }
  
  res.json({
    progress: torrent.progress,
    downloadSpeed: torrent.downloadSpeed,
    numPeers: torrent.numPeers,
    timeRemaining: torrent.timeRemaining,
    ready: torrent.ready
  });
});

// Stream endpoint with advanced caching
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

  // Set streaming-specific headers
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Streaming-Mode', 'memory-only');

  // Handle range requests for video streaming
  const range = req.headers.range;
  if (range) {
    const positions = range.replace(/bytes=/, '').split('-');
    const start = parseInt(positions[0], 10);
    const fileSize = file.length;
    
    // Use a larger chunk size for range requests to reduce requests
    const end = positions[1] 
      ? parseInt(positions[1], 10) 
      : Math.min(start + Math.floor(STREAM_CACHE_SIZE / 3), fileSize - 1);
      
    const chunkSize = (end - start) + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': mimeType,
      'Cache-Control': 'no-store' // Prevent browser from storing the entire file
    });

    // Advanced piece prioritization
    const pieceLength = torrent.pieceLength;
    const startPiece = Math.floor(start / pieceLength);
    const endPiece = Math.ceil(end / pieceLength);
    
    // Aggressively prioritize immediate pieces and gradually decrease priority for further pieces
    for (let i = 0; i < PIECE_BUFFER_SIZE; i++) {
      const pieceIndex = startPiece + i;
      
      if (pieceIndex < torrent.pieces.length) {
        if (i < 10) {
          // Critical pieces (next 10 pieces) - highest priority
          torrent.select(pieceIndex, pieceIndex + 1, 10);
        } else if (i < 20) {
          // High priority for next 10 pieces
          torrent.select(pieceIndex, pieceIndex + 1, 5);
        } else {
          // Normal priority for further pieces
          torrent.select(pieceIndex, pieceIndex + 1, 1);
        }
      }
    }

    // Deselect pieces far in the buffer to focus resources
    const deselectionPoint = startPiece + PIECE_BUFFER_SIZE + 30;
    if (deselectionPoint < torrent.pieces.length) {
      torrent.deselect(deselectionPoint, torrent.pieces.length, 0);
    }

    // Stream the data
    const stream = file.createReadStream({ start, end });
    stream.pipe(res);
    
    // Handle stream errors
    stream.on('error', (err) => {
      console.error('Stream error:', err);
      res.end();
    });
  } else {
    // For non-range requests, still limit cache size
    const initialChunkSize = Math.min(file.length, STREAM_CACHE_SIZE / 2);
    res.setHeader('Content-Length', initialChunkSize);
    
    // Start streaming from beginning with cache limit
    const stream = file.createReadStream({ start: 0, end: initialChunkSize - 1 });
    stream.pipe(res);
    
    // Handle stream errors
    stream.on('error', (err) => {
      console.error('Stream error:', err);
      res.end();
    });
  }
});

// Helper function to determine MIME type
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const types = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.mov': 'video/quicktime',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.aac': 'audio/aac',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.srt': 'text/plain',
    '.vtt': 'text/vtt',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript'
  };
  
  return types[ext] || 'application/octet-stream';
}

// Utility function to format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// API endpoint to remove a specific torrent
app.delete('/api/torrent/:infoHash', (req, res) => {
  const { infoHash } = req.params;
  const torrent = client.torrents.find(t => t.infoHash === infoHash);
  
  if (!torrent) {
    return res.status(404).json({ error: 'Torrent not found' });
  }
  
  // Remove the torrent from the client
  client.remove(torrent.infoHash, (err) => {
    if (err) {
      console.error('Error removing torrent:', err);
      return res.status(500).json({ error: 'Failed to remove torrent' });
    }
    
    console.log(`Torrent ${infoHash} removed successfully`);
    res.json({ success: true, message: 'Torrent removed successfully' });
  });
});

// Always serve the React app for client-side routing
app.get('*', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
  } else {
    res.sendFile(path.resolve(__dirname, 'client', 'public', 'index.html'));
  }
});

// Cleanup function to remove torrents when browser disconnects
const cleanupTorrents = () => {
  console.log('Cleaning up torrents...');
  client.torrents.forEach(torrent => {
    torrent.destroy();
  });
};

// Register cleanup on exit
process.on('SIGINT', () => {
  cleanupTorrents();
  process.exit();
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 