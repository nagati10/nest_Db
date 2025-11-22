import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface UserData {
  userId: string;
  userName?: string;
}

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

  private rooms = new Map<string, Map<string, UserData>>(); // roomId -> Map<socketId, userData>
  private userSocketMap = new Map<string, string>(); // userId -> socketId
  private socketUserMap = new Map<string, string>(); // socketId -> userId

  handleConnection(client: Socket) {
    console.log('✅ Client connected:', client.id);
    console.log('📊 Total connected clients:', this.server.engine.clientsCount);
  }

  handleDisconnect(client: Socket) {
    console.log('❌ Client disconnected:', client.id);
    
    // Remove from userSocketMap and socketUserMap
    const userId = this.socketUserMap.get(client.id);
    if (userId) {
      this.userSocketMap.delete(userId);
      this.socketUserMap.delete(client.id);
      console.log(`🗑️ User ${userId} removed from mapping`);
    }
    
    // Remove client from all rooms and notify others
    this.rooms.forEach((users, roomId) => {
      if (users && users.has(client.id)) {
        const userData = users.get(client.id);
        users.delete(client.id);
        
        // Notify other users in the room
        client.to(roomId).emit('user-left', { 
          socketId: client.id,
          userId: userData?.userId 
        });
        
        console.log(`🚪 User left room ${roomId}, remaining: ${users.size}`);
        
        if (users.size === 0) {
          this.rooms.delete(roomId);
          console.log(`🏁 Room ${roomId} deleted (empty)`);
        }
      }
    });

    console.log('📊 Total connected clients after disconnect:', this.server.engine.clientsCount - 1);
  }

  @SubscribeMessage('register')
  handleRegister(client: Socket, data: any) {
    try {
      const { userId } = data;
      if (!userId) {
        console.log('❌ Register failed: missing userId');
        client.emit('register-error', { error: 'User ID is required' });
        return;
      }

      // Remove previous registration for this user
      const existingSocketId = this.userSocketMap.get(userId);
      if (existingSocketId && existingSocketId !== client.id) {
        console.log(`🔄 User ${userId} re-registered from new socket, removing old: ${existingSocketId}`);
        this.socketUserMap.delete(existingSocketId);
      }

      // Register new mapping
      this.userSocketMap.set(userId, client.id);
      this.socketUserMap.set(client.id, userId);

      console.log(`✅ User ${userId} registered with socket ${client.id}`);
      console.log('📋 Current registered users:', Array.from(this.userSocketMap.keys()));
      
      client.emit('register-success', { userId });
    } catch (error) {
      console.error('❌ Register error:', error);
      client.emit('register-error', { error: 'Registration failed' });
    }
  }

  @SubscribeMessage('call-request')
  handleCallRequest(client: Socket, data: any) {
    try {
      const { roomId, fromUserId, fromUserName, toUserId, isVideoCall } = data;
      
      if (!roomId || !fromUserId || !fromUserName || !toUserId) {
        console.log('❌ Call request failed: missing required fields');
        client.emit('call-request-failed', { 
          reason: 'Missing required fields' 
        });
        return;
      }

      console.log('🔔 CALL_REQUEST_RECEIVED:', {
        roomId,
        fromUserId,
        fromUserName,
        toUserId,
        isVideoCall,
        clientId: client.id
      });

      console.log('🔍 Looking for target user:', toUserId);
      console.log('📋 Available users:', Array.from(this.userSocketMap.keys()));
      
      // Check if the target user is connected and registered
      const targetSocketId = this.userSocketMap.get(toUserId);
      
      if (targetSocketId) {
        const callId = `call_${Date.now()}`;
        console.log(`🎯 Sending incoming-call to socket: ${targetSocketId} for user: ${toUserId}`);
        
        const callData = {
          roomId,
          fromUserId,
          fromUserName,
          isVideoCall,
          callId,
          timestamp: new Date().toISOString()
        };

        // Send call request to the target user
        client.to(targetSocketId).emit('incoming-call', callData);
        
        client.emit('call-request-sent', { 
          success: true, 
          callId,
          toUserId 
        });
        
        console.log('✅ Call request sent successfully to', toUserId);
      } else {
        console.log('❌ Target user not found or offline:', toUserId);
        client.emit('call-request-failed', { 
          reason: 'User not available or offline',
          toUserId
        });
      }
    } catch (error) {
      console.error('❌ Call request error:', error);
      client.emit('call-request-failed', { 
        reason: 'Internal server error' 
      });
    }
  }

  @SubscribeMessage('call-response')
  handleCallResponse(client: Socket, data: any) {
    try {
      const { roomId, toUserId, accepted, callId } = data;
      
      if (!roomId || !toUserId || !callId) {
        console.log('❌ Call response failed: missing required fields');
        return;
      }

      console.log(`📞 Call response: ${accepted ? 'Accepted' : 'Rejected'} for call ${callId}`);
      
      // Find the target user's socket (the caller)
      const targetSocketId = this.userSocketMap.get(toUserId);
      
      if (targetSocketId) {
        const fromUserId = this.socketUserMap.get(client.id);
        
        client.to(targetSocketId).emit('call-response', {
          accepted,
          callId,
          fromUserId,
          roomId
        });

        console.log(`✅ Call response sent to ${toUserId}`);
        
        if (accepted) {
          console.log(`🎉 Call accepted, joining room: ${roomId}`);
          // Notify both users to join the room
          client.emit('join-call-room', { roomId });
          client.to(targetSocketId).emit('join-call-room', { roomId });
        }
      } else {
        console.log('❌ Caller not found for response:', toUserId);
        client.emit('call-response-failed', {
          callId,
          reason: 'Caller not available'
        });
      }
    } catch (error) {
      console.error('❌ Call response error:', error);
    }
  }

  @SubscribeMessage('cancel-call')
  handleCancelCall(client: Socket, data: any) {
    try {
      const { callId, toUserId } = data;
      
      if (!callId || !toUserId) {
        console.log('❌ Cancel call failed: missing callId or toUserId');
        return;
      }

      console.log(`❌ Call cancelled: ${callId} for user: ${toUserId}`);
      
      const targetSocketId = this.userSocketMap.get(toUserId);
      
      if (targetSocketId) {
        client.to(targetSocketId).emit('call-cancelled', { 
          callId,
          reason: 'Call cancelled by caller'
        });
        console.log('✅ Cancel notification sent to', toUserId);
      } else {
        console.log('❌ Target user not found for cancel:', toUserId);
      }
    } catch (error) {
      console.error('❌ Cancel call error:', error);
    }
  }

  @SubscribeMessage('join-call')
  handleJoinCall(client: Socket, data: any) {
    try {
      const { roomId, userId, userName } = data;
      
      if (!roomId || !userId) {
        console.log('❌ Join call failed: missing roomId or userId');
        return;
      }

      console.log(`🚪 User ${userId} joining call room: ${roomId}`);
      
      // Join the socket room
      client.join(roomId);
      
      // Initialize room if it doesn't exist
      if (!this.rooms.has(roomId)) {
        this.rooms.set(roomId, new Map());
        console.log(`🏠 New room created: ${roomId}`);
      }
      
      const room = this.rooms.get(roomId);
      
      // Check if room exists (it should after the set above)
      if (!room) {
        console.log('❌ Room not found after creation:', roomId);
        return;
      }
      
      // Add user to room
      room.set(client.id, { userId, userName });
      
      // Notify others in the room
      client.to(roomId).emit('user-joined', {
        socketId: client.id,
        userId,
        userName
      });
      
      // Send current room participants to the joining user
      const participants = Array.from(room.entries()).map(([socketId, userData]) => ({
        socketId,
        userId: userData.userId,
        userName: userData.userName
      })).filter(participant => participant.socketId !== client.id);
      
      client.emit('room-participants', {
        participants,
        roomId
      });

      console.log(`✅ User ${userId} joined room ${roomId}, total participants: ${room.size}`);
    } catch (error) {
      console.error('❌ Join call error:', error);
    }
  }

  @SubscribeMessage('leave-call')
  handleLeaveCall(client: Socket, data: any) {
    try {
      const { roomId } = data;
      
      if (!roomId) {
        return;
      }

      const room = this.rooms.get(roomId);
      if (room && room.has(client.id)) {
        const userData = room.get(client.id);
        room.delete(client.id);
        
        client.leave(roomId);
        
        // Notify others
        client.to(roomId).emit('user-left', {
          socketId: client.id,
          userId: userData?.userId
        });
        
        console.log(`🚪 User left call room: ${roomId}, remaining: ${room.size}`);
        
        if (room.size === 0) {
          this.rooms.delete(roomId);
          console.log(`🏁 Call room ${roomId} deleted (empty)`);
        }
      }
    } catch (error) {
      console.error('❌ Leave call error:', error);
    }
  }

  @SubscribeMessage('offer')
  handleOffer(client: Socket, data: any) {
    try {
      const { offer, roomId } = data;
      
      if (!offer || !roomId) {
        console.log('❌ Offer failed: missing offer or roomId');
        return;
      }

      console.log(`📤 Offer from ${client.id} in room ${roomId}`);
      
      // Broadcast to all other users in the room
      client.to(roomId).emit('offer', {
        offer,
        fromSocketId: client.id,
        roomId
      });
      
      console.log(`✅ Offer broadcasted to room ${roomId}`);
    } catch (error) {
      console.error('❌ Offer error:', error);
    }
  }

  @SubscribeMessage('answer')
  handleAnswer(client: Socket, data: any) {
    try {
      const { answer, roomId } = data;
      
      if (!answer || !roomId) {
        console.log('❌ Answer failed: missing answer or roomId');
        return;
      }

      console.log(`📥 Answer from ${client.id} in room ${roomId}`);
      
      // Broadcast to all other users in the room
      client.to(roomId).emit('answer', {
        answer,
        fromSocketId: client.id,
        roomId
      });
      
      console.log(`✅ Answer broadcasted to room ${roomId}`);
    } catch (error) {
      console.error('❌ Answer error:', error);
    }
  }

  @SubscribeMessage('ice-candidate')
  handleIceCandidate(client: Socket, data: any) {
    try {
      const { candidate, roomId } = data;
      
      if (!candidate || !roomId) {
        console.log('❌ ICE candidate failed: missing candidate or roomId');
        return;
      }

      console.log(`🧊 ICE candidate from ${client.id} in room ${roomId}`);
      
      // Broadcast to all other users in the room
      client.to(roomId).emit('ice-candidate', {
        candidate,
        fromSocketId: client.id,
        roomId
      });
      
      console.log(`✅ ICE candidate broadcasted to room ${roomId}`);
    } catch (error) {
      console.error('❌ ICE candidate error:', error);
    }
  }

  @SubscribeMessage('get-connection-status')
  handleGetConnectionStatus(client: Socket, data: any) {
    try {
      const { userId } = data;
      const isOnline = userId ? this.userSocketMap.has(userId) : false;
      
      client.emit('connection-status', {
        userId,
        isOnline,
        socketId: client.id
      });
    } catch (error) {
      console.error('❌ Get connection status error:', error);
    }
  }

  // Helper method to get user ID by socket ID
  private getUserIdBySocketId(socketId: string): string | null {
    return this.socketUserMap.get(socketId) || null;
  }

  // Helper method to get all connected users (for debugging)
  @SubscribeMessage('get-connected-users')
  handleGetConnectedUsers(client: Socket) {
    const connectedUsers = Array.from(this.userSocketMap.entries()).map(([userId, socketId]) => ({
      userId,
      socketId,
      isOnline: true
    }));

    client.emit('connected-users', { users: connectedUsers });
  }

  // Helper method to get room info (for debugging)
  @SubscribeMessage('get-room-info')
  handleGetRoomInfo(client: Socket, data: any) {
    const { roomId } = data;
    if (!roomId) {
      return;
    }

    const room = this.rooms.get(roomId);
    if (room) {
      const participants = Array.from(room.entries()).map(([socketId, userData]) => ({
        socketId,
        userId: userData.userId,
        userName: userData.userName
      }));

      client.emit('room-info', {
        roomId,
        participantCount: room.size,
        participants
      });
    } else {
      client.emit('room-info', {
        roomId,
        participantCount: 0,
        participants: []
      });
    }
  }
}