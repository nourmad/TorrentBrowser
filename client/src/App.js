import React, { useState, useEffect, useRef } from 'react';
import WebTorrent from 'webtorrent';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Container, Row, Col, Form, Button, Alert, Card, ListGroup, Spinner, Badge, ProgressBar, Tooltip, OverlayTrigger, ButtonGroup, Collapse } from 'react-bootstrap';
import { FaSun, FaMoon, FaFileVideo, FaFileAudio, FaFileAlt, FaInfoCircle, FaFileCode, FaStream, FaNetworkWired, FaTachometerAlt, FaPlay, FaPause, FaForward, FaBackward, FaImage, FaEye, FaEyeSlash } from 'react-icons/fa';
import './App.css';

function App() {
  const [magnetLink, setMagnetLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [torrentInfo, setTorrentInfo] = useState(null);
  const [currentFile, setCurrentFile] = useState(null);
  const [darkMode, setDarkMode] = useState(localStorage.getItem('darkMode') === 'true');
  const [, setTextContent] = useState('');
  const [, setTextLoading] = useState(false);
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const [peerCount, setPeerCount] = useState(0);
  const [, setLastPlaybackPosition] = useState(0);
  const [statusPollingActive, setStatusPollingActive] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState({});
  const [filePreviewContent, setFilePreviewContent] = useState({});
  const [secondaryViewer, setSecondaryViewer] = useState(null);
  const [secondaryViewerContent, setSecondaryViewerContent] = useState('');
  const [secondaryViewerLoading, setSecondaryViewerLoading] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [cleanupNotification, setCleanupNotification] = useState('');
  const videoRef = useRef(null);
  const statusIntervalRef = useRef(null);
  const cleanupRef = useRef(null);
  // WebTorrent client reference
  const clientRef = useRef(null);
  const torrentRef = useRef(null);

  useEffect(() => {
    // Apply theme on initial load and when darkMode changes
    if (darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('darkMode', 'false');
    }
  }, [darkMode]);

  // Add cleanup on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (torrentInfo) {
        removeTorrent();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Also clean up when component unmounts
      if (torrentInfo) {
        removeTorrent();
      }
    };
  }, [torrentInfo]);

  // Auto-select the largest file when the torrent info is loaded
  useEffect(() => {
    if (torrentInfo && torrentInfo.files && torrentInfo.files.length > 0) {
      // Find the largest file
      const largestFile = torrentInfo.files.reduce((prev, current) => 
        prev.length > current.length ? prev : current
      );
      setCurrentFile(largestFile);
      
      // Initialize stream stats
      if (torrentInfo.downloadSpeed) setDownloadSpeed(torrentInfo.downloadSpeed);
      if (torrentInfo.peers) setPeerCount(torrentInfo.peers);
      
      // Start status polling
      setStatusPollingActive(true);
    }
  }, [torrentInfo]);

  // Load text content when a text file is selected
  useEffect(() => {
    if (currentFile && isTextFile(currentFile.name)) {
      loadTextContent(currentFile);
    } else {
      // Clear text content when non-text file is selected
      setTextContent('');
    }
  }, [currentFile]);

  // Save and restore video position
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setLastPlaybackPosition(video.currentTime);
      localStorage.setItem(`playback-${currentFile?.path}`, video.currentTime.toString());
    };

    // Restore last playback position
    const lastPosition = localStorage.getItem(`playback-${currentFile?.path}`);
    if (lastPosition && !isNaN(parseFloat(lastPosition))) {
      video.currentTime = parseFloat(lastPosition);
    }

    video.addEventListener('timeupdate', handleTimeUpdate);
    
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [currentFile]);
  
  // Add keyboard controls for video playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const handleKeyDown = (e) => {
      // Left arrow key - rewind 10 seconds
      if (e.key === 'ArrowLeft') {
        video.currentTime = Math.max(video.currentTime - 10, 0);
        e.preventDefault();
        e.stopPropagation();
      }
      
      // Right arrow key - forward 10 seconds
      if (e.key === 'ArrowRight') {
        video.currentTime = Math.min(
          video.currentTime + 10, 
          video.duration || Infinity
        );
        e.preventDefault();
        e.stopPropagation();
      }
      
      // Space bar - play/pause
      if (e.key === ' ') {
        if (video.paused) {
          video.play();
        } else {
          video.pause();
        }
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // Use the video element directly 
    video.addEventListener('keydown', handleKeyDown, true);
    // Also keep document level for when video is not focused
    document.addEventListener('keydown', handleKeyDown, true);
    
    return () => {
      if (video) {
        video.removeEventListener('keydown', handleKeyDown, true);
      }
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [currentFile]); // Re-add listener when file changes

  // Poll for torrent status updates
  useEffect(() => {
    // Clear any existing interval
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }
    
    if (statusPollingActive && torrentRef.current) {
      const updateStatus = () => {
        const torrent = torrentRef.current;
        if (!torrent) return;
        
        // Update state with current torrent values
        setTorrentInfo(prev => ({
          ...prev,
          progress: torrent.progress,
          downloadSpeed: torrent.downloadSpeed,
          numPeers: torrent.numPeers,
          timeRemaining: torrent.timeRemaining
        }));
        
        setDownloadSpeed(torrent.downloadSpeed || 0);
        setPeerCount(torrent.numPeers || 0);
      };
      
      // Update immediately
      updateStatus();
      
      // Then set interval - poll frequently for better speed updates
      statusIntervalRef.current = setInterval(updateStatus, 1000);
    }
    
    return () => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
      }
    };
  }, [statusPollingActive]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
      }
    };
  }, []);

  // Reset error state when changing files
  useEffect(() => {
    setVideoError(false);
    setRetryCount(0);
  }, [currentFile]);

  // Add effect to auto-dismiss cleanup notification
  useEffect(() => {
    if (cleanupNotification) {
      const timer = setTimeout(() => {
        setCleanupNotification('');
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [cleanupNotification]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  // Function to remove a torrent
  const removeTorrent = () => {
    if (!torrentRef.current) return;
    
    try {
      // Destroy the torrent
      torrentRef.current.destroy();
      console.log(`Torrent ${torrentRef.current.infoHash} removed successfully`);
      setCleanupNotification('Torrent removed from cache');
      
      // Clear the reference
      torrentRef.current = null;
      
      // Clear UI state
      setTorrentInfo(null);
      setCurrentFile(null);
      setSecondaryViewer(null);
      setStatusPollingActive(false);
    } catch (err) {
      console.error('Error removing torrent:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!magnetLink.trim() || !magnetLink.startsWith('magnet:')) {
      setError('Please enter a valid magnet link');
      return;
    }

    // Clean up existing torrent if present
    if (torrentRef.current) {
      torrentRef.current.destroy();
      torrentRef.current = null;
    }

    setLoading(true);
    
    try {
      // Add the torrent using WebTorrent client
      clientRef.current.add(magnetLink, (torrent) => {
        torrentRef.current = torrent;
        
        // Create the torrent info object similar to what the server would return
        const torrentData = {
          infoHash: torrent.infoHash,
          files: torrent.files.map(file => ({
            name: file.name,
            length: file.length,
            path: file.path,
            // Store the file object itself for direct browser streaming
            fileObject: file
          })),
          progress: torrent.progress,
          downloadSpeed: torrent.downloadSpeed,
          numPeers: torrent.numPeers,
          timeRemaining: torrent.timeRemaining
        };
        
        setTorrentInfo(torrentData);
        
        // Set up event listeners for torrent updates
        torrent.on('download', () => {
          if (torrentRef.current === torrent) {
            setDownloadSpeed(torrent.downloadSpeed);
            setPeerCount(torrent.numPeers);
            setTorrentInfo(prevInfo => ({
              ...prevInfo,
              progress: torrent.progress,
              downloadSpeed: torrent.downloadSpeed,
              numPeers: torrent.numPeers,
              timeRemaining: torrent.timeRemaining
            }));
          }
        });
        
        torrent.on('wire', () => {
          if (torrentRef.current === torrent) {
            setPeerCount(torrent.numPeers);
          }
        });
        
        // Start status polling
        setStatusPollingActive(true);
      });
      
      // Set up cleanup function for beforeunload
      cleanupRef.current = () => {
        if (torrentRef.current) {
          torrentRef.current.destroy();
          torrentRef.current = null;
        }
      };
      
    } catch (err) {
      setError(`Failed to process magnet link: ${err.message}`);
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTextContent = async (file) => {
    setTextLoading(true);
    try {
      // Use the WebTorrent file object directly
      const arrayBuffer = await new Promise((resolve, reject) => {
        file.fileObject.getBuffer((err, buffer) => {
          if (err) reject(err);
          else resolve(buffer);
        });
      });
      
      // Convert buffer to text
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(arrayBuffer);
      setTextContent(text);
    } catch (err) {
      console.error('Error loading text file:', err);
      setTextContent('Error loading file content.');
    } finally {
      setTextLoading(false);
    }
  };

  const handleSecondaryViewerSelect = (file) => {
    if (isTextFile(file.name) || isImage(file.name)) {
      setSecondaryViewer(file);
      if (isTextFile(file.name)) {
        loadSecondaryViewerContent(file);
      }
    }
  };

  const loadSecondaryViewerContent = async (file) => {
    setSecondaryViewerLoading(true);
    try {
      // Use the WebTorrent file object directly
      const arrayBuffer = await new Promise((resolve, reject) => {
        file.fileObject.getBuffer((err, buffer) => {
          if (err) reject(err);
          else resolve(buffer);
        });
      });
      
      // Convert buffer to text
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(arrayBuffer);
      setSecondaryViewerContent(text);
    } catch (err) {
      console.error('Error loading content for secondary viewer:', err);
      setSecondaryViewerContent('Error loading file content.');
    } finally {
      setSecondaryViewerLoading(false);
    }
  };

  const handleFileSelect = (file) => {
    // For video and audio files, use the main player
    if (isVideo(file.name) || isAudio(file.name)) {
      setCurrentFile(file);
    } 
    // For text and image files, use the secondary viewer
    else if (isTextFile(file.name) || isImage(file.name)) {
      handleSecondaryViewerSelect(file);
    }
    // For other file types, still set as current file
    else {
      setCurrentFile(file);
    }
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSec) => {
    if (!bytesPerSec || bytesPerSec < 0) return '0 KB/s';
    return formatSize(bytesPerSec) + '/s';
  };

  const isImage = (fileName) => {
    if (!fileName) return false;
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff', '.tif'];
    const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    return imageExtensions.includes(ext);
  };

  const isVideo = (fileName) => {
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
    const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    return videoExtensions.includes(ext);
  };

  const isAudio = (fileName) => {
    const audioExtensions = ['.mp3', '.wav', '.ogg', '.flac', '.aac'];
    const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    return audioExtensions.includes(ext);
  };

  const isTextFile = (fileName) => {
    const textExtensions = ['.txt', '.log', '.md', '.csv', '.json', '.xml', '.html', '.css', '.js', '.srt', '.vtt'];
    const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    return textExtensions.includes(ext);
  };

  const getFileIcon = (fileName) => {
    if (isVideo(fileName)) return <FaFileVideo className="me-2" />;
    if (isAudio(fileName)) return <FaFileAudio className="me-2" />;
    if (isTextFile(fileName)) return <FaFileCode className="me-2" />;
    if (isImage(fileName)) return <FaImage className="me-2" />;
    return <FaFileAlt className="me-2" />;
  };

  const handleVideoSkip = (seconds) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.currentTime + seconds, videoRef.current.duration));
  };

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
  };

  const getStreamQualityColor = () => {
    if (!downloadSpeed) return 'secondary';
    if (downloadSpeed > 2 * 1024 * 1024) return 'success'; // > 2MB/s
    if (downloadSpeed > 1024 * 1024) return 'info';       // > 1MB/s
    if (downloadSpeed > 300 * 1024) return 'warning';     // > 300KB/s
    return 'danger';                                      // < 300KB/s
  };

  const renderVideoControls = () => {
    if (!isVideo(currentFile?.name)) return null;
    
    return (
      <div className="video-controls mt-3">
        <div className="d-flex justify-content-center">
          <ButtonGroup>
            <Button variant="outline-secondary" onClick={() => handleVideoSkip(-30)}>
              <FaBackward /> 30s
            </Button>
            <Button variant="outline-secondary" onClick={() => handleVideoSkip(-10)}>
              <FaBackward /> 10s
            </Button>
            <Button variant="outline-primary" onClick={handlePlayPause}>
              {videoRef.current?.paused ? <FaPlay /> : <FaPause />}
            </Button>
            <Button variant="outline-secondary" onClick={() => handleVideoSkip(10)}>
              <FaForward /> 10s
            </Button>
            <Button variant="outline-secondary" onClick={() => handleVideoSkip(30)}>
              <FaForward /> 30s
            </Button>
          </ButtonGroup>
        </div>
      </div>
    );
  };

  const renderStreamingStats = () => {
    if (!currentFile) return null;
    
    return (
      <div className="stream-stats d-flex align-items-center mt-3">
        <Badge bg={getStreamQualityColor()} className="me-2 stream-quality-badge">
          <FaTachometerAlt className="me-1" /> {formatSpeed(downloadSpeed)}
        </Badge>
        
        <Badge bg="secondary" className="me-2">
          <FaNetworkWired className="me-1" /> {peerCount} peers
        </Badge>
        
        {torrentInfo && torrentInfo.progress < 1 && (
          <Badge bg="info" className="me-2">
            Buffer: {Math.round(torrentInfo.progress * 100)}%
          </Badge>
        )}
      </div>
    );
  };

  const renderMediaPlayer = () => {
    if (!currentFile) return null;

    const isVideoFile = isVideo(currentFile.name);
    const isAudioFile = isAudio(currentFile.name);

    console.log('Rendering media player for:', currentFile.name);
    console.log('Media type:', { isVideoFile, isAudioFile });

    if (isVideoFile) {
      return (
        <div className="position-relative">
          {videoError ? (
            <Alert variant="warning" className="mb-3">
              <FaInfoCircle className="me-2" />
              Video playback error. {retryCount < 3 ? "Attempting to recover..." : "Try selecting the file again or check your connection."}
              {retryCount < 3 && (
                <div className="text-center mt-2">
                  <Spinner animation="border" size="sm" role="status" />
                </div>
              )}
            </Alert>
          ) : null}
          
          <video 
            ref={videoRef}
            controls 
            className="w-100 mt-3" 
            style={{ maxHeight: '700px', borderRadius: '8px' }}
            autoPlay
            src={URL.createObjectURL(currentFile.fileObject)}
            onError={handleVideoError}
          >
            Your browser does not support the video tag.
          </video>
          {renderVideoControls()}
          {renderStreamingStats()}
        </div>
      );
    } else if (isAudioFile) {
      return (
        <div className="mt-3 p-4 bg-secondary bg-opacity-10 rounded">
          <div className="text-center mb-3">
            <FaFileAudio style={{ fontSize: '3rem', opacity: '0.7' }} />
          </div>
          <audio 
            controls 
            className="w-100"
            autoPlay
            src={URL.createObjectURL(currentFile.fileObject)}
            onError={(e) => {
              console.error("Audio playback error:", e);
              setVideoError(true);
            }}
          >
            Your browser does not support the audio tag.
          </audio>
          {videoError && (
            <Alert variant="warning" className="mt-3">
              <FaInfoCircle className="me-2" />
              Audio playback error. Try selecting the file again or check your connection.
            </Alert>
          )}
          {renderStreamingStats()}
        </div>
      );
    } else {
      return (
        <div className="mt-3">
          <Alert variant="info">
            <FaInfoCircle className="me-2" />
            This file type cannot be previewed in the media player.
          </Alert>
        </div>
      );
    }
  };

  const renderStreamingBadge = () => {
    return (
      <OverlayTrigger
        placement="top"
        overlay={<Tooltip>In-browser streaming - no server required</Tooltip>}
      >
        <Badge bg="info" className="ms-2">
          <FaStream className="me-1" /> Browser Streaming
        </Badge>
      </OverlayTrigger>
    );
  };

  // Add a new function to toggle file expansion
  const toggleFileExpansion = (filePath) => {
    setExpandedFiles(prev => {
      const newState = { ...prev, [filePath]: !prev[filePath] };
      
      // If we're expanding and need to load a preview
      if (newState[filePath]) {
        const file = torrentInfo.files.find(f => f.path === filePath);
        if (file && isTextFile(file.name)) {
          loadFilePreview(file);
        }
      }
      
      return newState;
    });
  };

  const loadFilePreview = async (file) => {
    try {
      // Use the WebTorrent file object directly
      const arrayBuffer = await new Promise((resolve, reject) => {
        file.fileObject.getBuffer((err, buffer) => {
          if (err) reject(err);
          else resolve(buffer);
        });
      });
      
      // Convert buffer to text and create preview
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(arrayBuffer);
      const previewText = text.length > 500 
        ? text.substring(0, 500) + (text.length > 500 ? '...' : '')
        : text;
        
      setFilePreviewContent(prev => ({
        ...prev,
        [file.path]: previewText
      }));
    } catch (err) {
      console.error('Error loading file preview:', err);
      setFilePreviewContent(prev => ({
        ...prev,
        [file.path]: 'Error loading preview'
      }));
    }
  };

  // Render file preview component
  const renderFilePreview = (file) => {
    if (!expandedFiles[file.path]) return null;
    
    if (isImage(file.name)) {
      return (
        <div className="file-preview mt-2 mb-2">
          <div className="text-center">
            <img 
              src={URL.createObjectURL(file.fileObject)} 
              alt={file.name} 
              className="img-thumbnail" 
              style={{ maxHeight: '200px', maxWidth: '100%' }} 
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNlZWUiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5OTkiPkltYWdlIGxvYWQgZXJyb3I8L3RleHQ+PC9zdmc+';
              }}
            />
          </div>
          <div className="text-center mt-2">
            <small className="text-muted">Path: {file.path}</small>
          </div>
        </div>
      );
    } else if (isTextFile(file.name)) {
      return (
        <div className="file-preview mt-2 mb-2">
          <div 
            className="text-preview p-2 border rounded" 
            style={{ 
              backgroundColor: darkMode ? '#2d2d2d' : '#f8f9fa',
              color: darkMode ? '#e0e0e0' : 'inherit',
              maxHeight: '200px',
              overflowY: 'auto',
              fontSize: '12px',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap'
            }}
          >
            {filePreviewContent[file.path] || 
              <div className="text-center py-2">
                <Spinner animation="border" size="sm" role="status" />
                <span className="ms-2">Loading preview...</span>
              </div>
            }
          </div>
        </div>
      );
    }
    
    return null;
  };

  // Render secondary viewer content
  const renderSecondaryViewer = () => {
    if (!secondaryViewer) return null;

    const isImageFile = isImage(secondaryViewer.name);
    const isTextField = isTextFile(secondaryViewer.name);

    return (
      <Row className="justify-content-center mt-4">
        <Col md={10} lg={10}>
          <Card className="shadow">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h3 className="mb-0">File Viewer</h3>
                <Badge bg={isImageFile ? "info" : "primary"}>
                  {isImageFile ? "Image" : "Text"} Viewer
                </Badge>
              </div>
              
              <div className="mb-3">
                <strong>{secondaryViewer.name}</strong>
                <span className="ms-2 text-muted">({formatSize(secondaryViewer.length)})</span>
                <Button 
                  variant="link" 
                  className="float-end p-0" 
                  onClick={() => setSecondaryViewer(null)}
                  aria-label="Close viewer"
                >
                  <FaEyeSlash />
                </Button>
              </div>

              {isImageFile && (
                <div className="text-center">
                  <div className="position-relative mb-3" style={{ minHeight: '100px' }}>
                    <img
                      src={URL.createObjectURL(secondaryViewer.fileObject)}
                      alt={secondaryViewer.name}
                      className="img-fluid rounded"
                      style={{ maxHeight: '600px' }}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNlZWUiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5OTkiPkltYWdlIGxvYWQgZXJyb3I8L3RleHQ+PC9zdmc+';
                      }}
                    />
                  </div>
                  <Alert variant="info" className="mb-3">
                    <div className="mb-2">
                      <strong>Image loaded from torrent</strong>
                    </div>
                    <a 
                      href={URL.createObjectURL(secondaryViewer.fileObject)}
                      download={secondaryViewer.name}
                      className="btn btn-outline-primary"
                    >
                      Download Image
                    </a>
                  </Alert>
                </div>
              )}

              {isTextField && (
                <div className="text-viewer p-3 border rounded" style={{ 
                  maxHeight: '600px', 
                  overflowY: 'auto', 
                  backgroundColor: darkMode ? '#2d2d2d' : '#f8f9fa',
                  color: darkMode ? '#e0e0e0' : 'inherit',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  fontSize: '14px',
                  lineHeight: '1.5'
                }}>
                  {secondaryViewerLoading ? (
                    <div className="text-center py-5">
                      <Spinner animation="border" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </Spinner>
                      <p className="mt-3">Loading text content...</p>
                    </div>
                  ) : (
                    secondaryViewerContent || 'No content available'
                  )}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    );
  };

  // Determine if we should show the media player section
  const showMediaPlayer = () => {
    return currentFile && (isVideo(currentFile.name) || isAudio(currentFile.name));
  };

  // Function to handle video error
  const handleVideoError = (e) => {
    console.error("Video playback error:", e);
    setVideoError(true);
    
    // Only attempt retry if retry count is under threshold
    if (retryCount < 3) {
      setRetryCount(prev => prev + 1);
      
      // Try to reload the video after a short delay
      setTimeout(() => {
        if (videoRef.current) {
          const currentSrc = videoRef.current.src;
          videoRef.current.src = '';
          setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.src = currentSrc;
              videoRef.current.load();
              videoRef.current.play().catch(err => console.error("Failed to play video after reload:", err));
            }
          }, 1000);
        }
        setVideoError(false);
      }, 3000);
    }
  };

  useEffect(() => {
    // Initialize WebTorrent client
    if (!clientRef.current) {
      clientRef.current = new WebTorrent();
      
      // Handle client errors
      clientRef.current.on('error', (err) => {
        console.error('WebTorrent client error:', err.message);
        setError(`WebTorrent error: ${err.message}`);
      });
    }
    
    return () => {
      // Clean up WebTorrent client on component unmount
      if (clientRef.current) {
        if (torrentRef.current) {
          torrentRef.current.destroy();
          torrentRef.current = null;
        }
        clientRef.current.destroy();
        clientRef.current = null;
      }
    };
  }, []);

  return (
    <>
      <button 
        className="theme-toggle" 
        onClick={toggleDarkMode} 
        aria-label="Toggle dark mode"
      >
        {darkMode ? <FaSun /> : <FaMoon />}
      </button>

      {cleanupNotification && (
        <div className="cleanup-notification">
          <Alert 
            variant="info" 
            className="position-fixed top-0 start-50 translate-middle-x mt-3"
            style={{ zIndex: 1050, maxWidth: '90%', width: '400px', textAlign: 'center' }}
          >
            {cleanupNotification}
          </Alert>
        </div>
      )}

      <Container className="py-5">
        <Row className="justify-content-center mb-4">
          <Col md={10} lg={10}>
            <Card className="shadow">
              <Card.Body className="px-4 py-5">
                <h1 className="app-title text-center">Torrent Stream</h1>
                
                <Form onSubmit={handleSubmit}>
                  <Form.Group className="mb-4">
                    <Form.Label>Magnet Link</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Enter magnet link (magnet:?xt=urn:btih:...)"
                      value={magnetLink}
                      onChange={(e) => setMagnetLink(e.target.value)}
                      required
                      className="mb-2"
                    />
                    <Form.Text>
                      Paste a magnet link to stream its content directly in your browser.
                    </Form.Text>
                  </Form.Group>
                  <div className="d-grid gap-2">
                    <Button variant="primary" type="submit" disabled={loading}>
                      {loading ? (
                        <>
                          <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" /> 
                          Processing Torrent...
                        </>
                      ) : (
                        'Stream Torrent'
                      )}
                    </Button>
                  </div>
                </Form>

                {error && (
                  <Alert variant="danger" className="mt-4">
                    <FaInfoCircle className="me-2" />
                    {error}
                  </Alert>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {showMediaPlayer() && (
          <Row className="justify-content-center mt-4">
            <Col md={10} lg={10}>
              <Card className="shadow">
                <Card.Body>
                  <h2 className="mb-3">Media Player</h2>
                  <p className="mb-4">
                    <span className="text-muted">Now playing:</span> 
                    <strong className="ms-2">{currentFile.name}</strong>
                    {renderStreamingBadge()}
                  </p>
                  {renderMediaPlayer()}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}

        {/* Render the secondary viewer for text and image files */}
        {secondaryViewer && renderSecondaryViewer()}

        {torrentInfo && (
          <Row className="justify-content-center mt-4">
            <Col md={10} lg={10}>
              <Card className="shadow">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <h2 className="mb-0">Files</h2>
                    <Badge bg="primary" pill>
                      {torrentInfo.files.length} Files
                    </Badge>
                  </div>
                  
                  {torrentInfo.progress < 1 && (
                    <div className="mb-4">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span>Streaming Progress</span>
                        <span>{Math.round(torrentInfo.progress * 100)}%</span>
                      </div>
                      <ProgressBar now={torrentInfo.progress * 100} />
                    </div>
                  )}

                  <ListGroup variant="flush">
                    {torrentInfo.files.map((file, index) => (
                      <ListGroup.Item 
                        key={index}
                        className="file-item"
                      >
                        <div 
                          className="d-flex justify-content-between align-items-center"
                          onClick={() => handleFileSelect(file)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="d-flex align-items-center">
                            {getFileIcon(file.name)}
                            <div className={currentFile && currentFile.path === file.path ? 'fw-bold' : ''}>
                              {file.name}
                            </div>
                          </div>
                          <div className="d-flex align-items-center">
                            <Badge bg="secondary" pill className="me-2">
                              {formatSize(file.length)}
                            </Badge>
                            {(isImage(file.name) || isTextFile(file.name)) && (
                              <Button 
                                variant="link" 
                                size="sm" 
                                className="p-0 me-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFileExpansion(file.path);
                                }}
                              >
                                {expandedFiles[file.path] ? 
                                  <FaEyeSlash title="Hide preview" /> : 
                                  <FaEye title="Show preview" />
                                }
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        <Collapse in={expandedFiles[file.path]}>
                          <div>
                            {renderFilePreview(file)}
                          </div>
                        </Collapse>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}

        <footer className="text-center mt-5">
          <p>© {new Date().getFullYear()} Torrent Stream | Stream responsibly and only for legal content</p>
        </footer>
      </Container>
    </>
  );
}

export default App;
