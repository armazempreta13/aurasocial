// Socket.io server stub for Cloudflare Workers compatibility.
// Cloudflare Workers don't support persistent HTTP servers or WebSocket upgrades
// via socket.io. The real-time messaging in production uses Firebase Firestore
// listeners + SSE signaling instead.

import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: {
    bodyParser: false,
  },
};

const ioHandler = (_req: NextApiRequest, res: NextApiResponse) => {
  // In production (Cloudflare Workers), socket.io is not available.
  // Real-time features use Firebase Firestore onSnapshot listeners
  // and the /api/signaling/listen SSE endpoint instead.
  res.status(200).json({ status: 'ok', message: 'Socket endpoint placeholder' });
};

export default ioHandler;
