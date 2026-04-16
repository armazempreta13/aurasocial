import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    socket = io({
      path: '/api/socket',
      reconnectionAttempts: 5,
    });
  }
  return socket;
};
