import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';

let io: Server | null = null;

export function initWebSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: 'http://localhost:5173',
      credentials: true,
    },
    path: '/ws',
  });

  io.on('connection', (socket) => {
    const companyId = socket.handshake.query['company_id'] as string | undefined;
    if (companyId) {
      void socket.join(`company:${companyId}`);
    }

    socket.on('disconnect', () => {
      // cleanup handled by socket.io
    });
  });

  return io;
}

export function emitEvent(companyId: string, event: string, data: unknown) {
  if (!io) return;
  io.to(`company:${companyId}`).emit('message', {
    event,
    data,
    timestamp: new Date().toISOString(),
  });
}
