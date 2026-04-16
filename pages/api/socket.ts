import { Server as NetServer } from 'http';
import { NextApiRequest } from 'next';
import { Server as SocketIOServer } from 'socket.io';

export const config = {
  api: {
    bodyParser: false,
  },
};

const ioHandler = (req: NextApiRequest, res: any) => {
  if (!res.socket.server.io) {
    console.log('[SOCKET] Initializing Socket.io server...');
    const httpServer: NetServer = res.socket.server as any;
    const io = new SocketIOServer(httpServer, {
      path: '/api/socket',
      addTrailingSlash: false,
    });
    
    io.on('connection', (socket) => {
      socket.on('join', (userId) => {
        socket.join(userId);
      });

      socket.on('send-message', (data) => {
        io.to(data.toId).emit('new-message', data);
      });

      socket.on('signal', (data) => {
        io.to(data.toId).emit('signal', data);
      });
      
      socket.on('typing-status', (data) => {
         io.to(data.toId).emit('typing-status', data);
      });
    });

    res.socket.server.io = io;
  }
  
  // Important: Always end the request so it's not a timeout
  res.end();
};

export default ioHandler;
