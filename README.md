# Torrent Streamer

A web application that allows users to stream torrent content directly in the browser using magnet links.

## Features

- Paste any magnet link and stream content directly in your browser
- Supports video and audio playback
- Responsive design for mobile and desktop
- File browser with file size information

## Technologies Used

- React for the frontend UI
- Express for the backend API
- WebTorrent for handling torrent downloads and streaming
- Bootstrap for responsive styling

## Prerequisites

- Node.js (v16 or higher, v18+ recommended)
- npm (v7 or higher)

## Installation

1. Clone the repository
   ```
   git clone <repository-url>
   cd torrent-streamer
   ```

2. Install server dependencies
   ```
   npm install
   ```

3. Install client dependencies
   ```
   cd client
   npm install
   cd ..
   ```

## Running the Application

1. For development (runs both client and server concurrently)
   ```
   npm run dev
   ```

2. For production
   ```
   npm run build
   npm start
   ```

The application will be available at http://localhost:3000 in development mode, or http://localhost:5000 in production mode.

## How to Use

1. Open the application in your web browser
2. Paste a valid magnet link into the input field
3. Click "Stream Torrent"
4. Once the torrent information loads, click on a file to stream it
5. The file will start streaming in the built-in media player

## Important Notes

- This application is designed for educational purposes only
- Only use this application to stream content that you have the legal right to access
- Streaming copyrighted material without permission may be illegal in your country

## License

MIT 