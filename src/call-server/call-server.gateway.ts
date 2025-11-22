import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: "*",
    credentials: true
  },
  transports: ['websocket', 'polling']
})
export class CallServerGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private rooms = new Map();

  handleConnection(client: Socket) {
    console.log('Client connected:', client.id);
  }

  handleDisconnect(client: Socket) {
    console.log('Client disconnected:', client.id);
    
    // Remove client from all rooms and notify others
    this.rooms.forEach((users, roomId) => {
      if (users.has(client.id)) {
        users.delete(client.id);
        client.to(roomId).emit('user-left', { socketId: client.id });
        
        if (users.size === 0) {
          this.rooms.delete(roomId);
        }
      }
    });
  }

  @SubscribeMessage('join-call')
  handleJoinCall(client: Socket, data: any) {
    const { roomId, userId, userName } = data;
    
    console.log(`User ${userName} joining room: ${roomId}`);
    
    // Join the room
    client.join(roomId);
    
    // Initialize room if it doesn't exist
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Map());
    }
    this.rooms.get(roomId).set(client.id, { userId, userName });

    // Notify others in the room
    client.to(roomId).emit('user-joined', {
      userId: userId,
      userName: userName,
      socketId: client.id
    });

    // Send current room users to the new user
    const roomUsers = Array.from(this.rooms.get(roomId).entries())
      .filter(([socketId, userData]) => socketId !== client.id)
      .map(([socketId, userData]) => ({
        socketId,
        userId: userData.userId,
        userName: userData.userName
      }));
    
    client.emit('room-users', roomUsers);
  }

  @SubscribeMessage('offer')
  handleOffer(client: Socket, data: any) {
    client.to(data.targetSocketId).emit('offer', {
      offer: data.offer,
      socketId: client.id
    });
  }

  @SubscribeMessage('answer')
  handleAnswer(client: Socket, data: any) {
    client.to(data.targetSocketId).emit('answer', {
      answer: data.answer,
      socketId: client.id
    });
  }

  @SubscribeMessage('ice-candidate')
  handleIceCandidate(client: Socket, data: any) {
    client.to(data.targetSocketId).emit('ice-candidate', {
      candidate: data.candidate,
      socketId: client.id,
      sdpMid: data.sdpMid,
      sdpMLineIndex: data.sdpMLineIndex
    });
  }

  @SubscribeMessage('toggle-audio')
  handleToggleAudio(client: Socket, data: any) {
    const roomId = this.findRoomBySocketId(client.id);
    if (roomId) {
      client.to(roomId).emit('user-audio-toggled', {
        socketId: client.id,
        isEnabled: data.isEnabled
      });
    }
  }

  @SubscribeMessage('toggle-video')
  handleToggleVideo(client: Socket, data: any) {
    const roomId = this.findRoomBySocketId(client.id);
    if (roomId) {
      client.to(roomId).emit('user-video-toggled', {
        socketId: client.id,
        isEnabled: data.isEnabled
      });
    }
  }

  @SubscribeMessage('end-call')
  handleEndCall(client: Socket) {
    const roomId = this.findRoomBySocketId(client.id);
    if (roomId) {
      client.to(roomId).emit('call-ended', { socketId: client.id });
    }
  }

  // In call-server.gateway.ts - Add these methods

@SubscribeMessage('call-request')
handleCallRequest(client: Socket, data: any) {
  const { roomId, fromUserId, fromUserName, toUserId, isVideoCall } = data;
  
  console.log(`Call request from ${fromUserName} to ${toUserId} in room ${roomId}`);
  
  // Find the target user's socket
  let targetSocketId: string | null = null;
  
  // Search through all rooms to find the target user
  for (const [room, users] of this.rooms.entries()) {
    for (const [socketId, userData] of users.entries()) {
      if (userData.userId === toUserId) {
        targetSocketId = socketId;
        break;
      }
    }
    if (targetSocketId) break;
  }
  
  if (targetSocketId) {
    // Send call request to the target user
    client.to(targetSocketId).emit('incoming-call', {
      roomId,
      fromUserId,
      fromUserName,
      isVideoCall,
      callId: `call_${Date.now()}`
    });
    
    client.emit('call-request-sent', { success: true });
  } else {
    client.emit('call-request-failed', { 
      reason: 'User not available or offline' 
    });
  }
}

@SubscribeMessage('call-response')
handleCallResponse(client: Socket, data: any) {
  const { roomId, toUserId, accepted, callId } = data;
  
  console.log(`Call response: ${accepted ? 'Accepted' : 'Rejected'} for call ${callId}`);
  
  // Find the target user's socket (the caller)
  let targetSocketId: string | null = null;
  
  for (const [room, users] of this.rooms.entries()) {
    for (const [socketId, userData] of users.entries()) {
      if (userData.userId === toUserId) {
        targetSocketId = socketId;
        break;
      }
    }
    if (targetSocketId) break;
  }
  
  if (targetSocketId) {
    client.to(targetSocketId).emit('call-response', {
      accepted,
      callId,
      fromUserId: this.getUserIdBySocketId(client.id)
    });
    
    if (accepted) {
      // Notify both users to join the room
      client.emit('join-call-room', { roomId });
      client.to(targetSocketId).emit('join-call-room', { roomId });
    }
  }
}

@SubscribeMessage('cancel-call')
handleCancelCall(client: Socket, data: any) {
  const { callId, toUserId } = data;
  
  // Find the target user's socket
  let targetSocketId: string | null = null;
  
  for (const [room, users] of this.rooms.entries()) {
    for (const [socketId, userData] of users.entries()) {
      if (userData.userId === toUserId) {
        targetSocketId = socketId;
        break;
      }
    }
    if (targetSocketId) break;
  }
  
  if (targetSocketId) {
    client.to(targetSocketId).emit('call-cancelled', { callId });
  }
}

// Helper method to get user ID by socket ID
private getUserIdBySocketId(socketId: string): string | null {
  for (const [roomId, users] of this.rooms.entries()) {
    if (users.has(socketId)) {
      return users.get(socketId).userId;
    }
  }
  return null;
}

  private findRoomBySocketId(socketId: string): string | null {
    for (const [roomId, users] of this.rooms.entries()) {
      if (users.has(socketId)) {
        return roomId;
      }
    }
    return null;
  }
}