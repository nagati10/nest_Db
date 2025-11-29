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

interface ActiveCall {
  callId: string;
  roomId: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  isVideoCall: boolean;
  status: 'ringing' | 'accepted' | 'rejected' | 'cancelled' | 'ended';
  timestamp: Date;
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

  private rooms = new Map<string, Map<string, UserData>>();
  private userSocketMap = new Map<string, string>();
  private socketUserMap = new Map<string, string>();
  private activeCalls = new Map<string, ActiveCall>(); // callId -> ActiveCall

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
    
    // End all calls for this user
    this.endUserCalls(userId || client.id, 'User disconnected');
    
    // Remove from rooms
    this.rooms.forEach((users, roomId) => {
      if (users && users.has(client.id)) {
        const userData = users.get(client.id);
        users.delete(client.id);
        
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
  }

  /**
   * End all calls for a user and notify all participants
   */
  private endUserCalls(userIdentifier: string, reason: string) {
    console.log(`🔚 Ending all calls for user: ${userIdentifier}, reason: ${reason}`);
    
    this.activeCalls.forEach((call, callId) => {
      if (call.fromUserId === userIdentifier || call.toUserId === userIdentifier) {
        console.log(`📞 Ending call ${callId} for user ${userIdentifier}`);
        
        // Notify both users about call end
        const fromSocketId = this.userSocketMap.get(call.fromUserId);
        const toSocketId = this.userSocketMap.get(call.toUserId);
        
        if (fromSocketId) {
          this.server.to(fromSocketId).emit('call-ended', {
            callId: call.callId,
            roomId: call.roomId,
            reason: reason
          });
        }
        
        if (toSocketId) {
          this.server.to(toSocketId).emit('call-ended', {
            callId: call.callId,
            roomId: call.roomId,
            reason: reason
          });
        }
        
        // Clean up room
        this.cleanupRoom(call.roomId);
        
        // Remove from active calls
        this.activeCalls.delete(callId);
        console.log(`🗑️ Call ${callId} removed from active calls`);
      }
    });
  }

  /**
   * Clean up room and notify all participants
   */
  private cleanupRoom(roomId: string) {
    const room = this.rooms.get(roomId);
    if (room) {
      console.log(`🧹 Cleaning up room: ${roomId}`);
      
      // Notify all users in the room that call is ending
      this.server.to(roomId).emit('call-ended', {
        roomId,
        reason: 'Call ended by another participant'
      });
      
      // Remove all users from the room
      room.forEach((userData, socketId) => {
        this.server.sockets.sockets.get(socketId)?.leave(roomId);
      });
      
      // Delete the room
      this.rooms.delete(roomId);
      console.log(`🏁 Room ${roomId} completely cleaned up`);
    }
  }

  @SubscribeMessage('register')
  handleRegister(client: Socket, data: any) {
    try {
      const { userId, userName } = data;
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
        
        // End any active calls for the old socket
        this.endUserCalls(userId, 'User reconnected from new device');
      }

      // Register new mapping
      this.userSocketMap.set(userId, client.id);
      this.socketUserMap.set(client.id, userId);

      console.log(`✅ User ${userId} registered with socket ${client.id}`);
      
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

      // Check if target user is already in a call
      const existingCall = Array.from(this.activeCalls.values()).find(
        call => (call.toUserId === toUserId || call.fromUserId === toUserId) && 
               (call.status === 'ringing' || call.status === 'accepted')
      );
      
      if (existingCall) {
        console.log('❌ Target user is already in a call');
        client.emit('call-request-failed', { 
          reason: 'User is already in a call' 
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

      // Check if the target user is connected and registered
      const targetSocketId = this.userSocketMap.get(toUserId);
      
      if (targetSocketId) {
        const callId = `call_${Date.now()}`;
        
        // Create active call record
        const activeCall: ActiveCall = {
          callId,
          roomId,
          fromUserId,
          fromUserName,
          toUserId,
          isVideoCall,
          status: 'ringing',
          timestamp: new Date()
        };
        
        this.activeCalls.set(callId, activeCall);
        
        console.log(`🎯 Sending incoming-call to user: ${toUserId}`);
        
        const callData = {
          callId,
          roomId,
          fromUserId,
          fromUserName,
          isVideoCall,
          timestamp: activeCall.timestamp.toISOString()
        };

        // Send call request to the target user
        client.to(targetSocketId).emit('incoming-call', callData);
        
        // Also send to caller for UI updates
        client.emit('call-started', callData);
        
        console.log('✅ Call request sent successfully');
        
        // Set timeout to auto-reject after 30 seconds
        setTimeout(() => {
          const call = this.activeCalls.get(callId);
          if (call && call.status === 'ringing') {
            this.activeCalls.delete(callId);
            client.emit('call-timeout', { callId });
            client.to(targetSocketId).emit('call-timeout', { callId });
            console.log(`⏰ Call ${callId} timed out`);
          }
        }, 30000);
        
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
      const { callId, accepted } = data;
      
      if (!callId) {
        console.log('❌ Call response failed: missing callId');
        client.emit('call-response-failed', { reason: 'Missing callId' });
        return;
      }

      console.log('📞 Call response received:', { callId, accepted, clientId: client.id });

      const call = this.activeCalls.get(callId);
      if (!call) {
        console.log('❌ Call not found:', callId);
        client.emit('call-response-failed', { callId, reason: 'Call not found' });
        return;
      }

      // Update call status
      call.status = accepted ? 'accepted' : 'rejected';
      
      // Find the caller's socket using the stored call information
      const callerSocketId = this.userSocketMap.get(call.fromUserId);
      
      if (callerSocketId) {
        const fromUserId = this.socketUserMap.get(client.id);
        
        // Notify caller about the response
        client.to(callerSocketId).emit('call-response', {
          callId,
          accepted,
          fromUserId: fromUserId || 'unknown'
        });

        console.log(`✅ Call response sent to caller: ${call.fromUserId}`);
        
        if (accepted) {
          console.log(`🎉 Call accepted, notifying to join room: ${call.roomId}`);
          
          // Notify both users to join the room
          client.emit('join-call-room', { 
            roomId: call.roomId,
            callId: call.callId
          });
          client.to(callerSocketId).emit('join-call-room', { 
            roomId: call.roomId,
            callId: call.callId
          });
          
          // Update call status to active
          call.status = 'accepted';
        } else {
          // Remove rejected call immediately
          this.activeCalls.delete(callId);
          console.log(`❌ Call ${callId} rejected and removed`);
        }
      } else {
        console.log('❌ Caller not found for response:', call.fromUserId);
        client.emit('call-response-failed', {
          callId,
          reason: 'Caller not available'
        });
        this.activeCalls.delete(callId);
      }
    } catch (error) {
      console.error('❌ Call response error:', error);
      client.emit('call-response-failed', { reason: 'Internal server error' });
    }
  }

  @SubscribeMessage('cancel-call')
  handleCancelCall(client: Socket, data: any) {
    try {
      const { callId } = data;
      
      if (!callId) {
        console.log('❌ Cancel call failed: missing callId');
        return;
      }

      const call = this.activeCalls.get(callId);
      if (!call) {
        console.log('❌ Call not found for cancellation:', callId);
        return;
      }

      console.log(`❌ Call cancelled: ${callId}`);
      
      // Update call status
      call.status = 'cancelled';
      
      const targetSocketId = this.userSocketMap.get(call.toUserId);
      
      if (targetSocketId) {
        client.to(targetSocketId).emit('call-cancelled', { 
          callId,
          reason: 'Call cancelled by caller'
        });
        console.log('✅ Cancel notification sent to', call.toUserId);
      }
      
      // Remove from active calls
      this.activeCalls.delete(callId);
    } catch (error) {
      console.error('❌ Cancel call error:', error);
    }
  }

  @SubscribeMessage('end-call')
  handleEndCall(client: Socket, data: any) {
    try {
      const { roomId, callId, reason = 'Call ended by user' } = data;
      
      console.log(`📞 End call request:`, { roomId, callId, reason, clientId: client.id });

      // If we have a callId, end that specific call
      if (callId) {
        const call = this.activeCalls.get(callId);
        if (call) {
          console.log(`🔚 Ending call ${callId} for room ${call.roomId}`);
          
          // Notify both users
          const fromSocketId = this.userSocketMap.get(call.fromUserId);
          const toSocketId = this.userSocketMap.get(call.toUserId);
          
          if (fromSocketId) {
            this.server.to(fromSocketId).emit('call-ended', {
              callId: call.callId,
              roomId: call.roomId,
              reason: reason
            });
          }
          
          if (toSocketId) {
            this.server.to(toSocketId).emit('call-ended', {
              callId: call.callId,
              roomId: call.roomId,
              reason: reason
            });
          }
          
          // Clean up room
          this.cleanupRoom(call.roomId);
          
          // Remove from active calls
          this.activeCalls.delete(callId);
        }
      }
      // If we only have roomId, end all calls in that room
      else if (roomId) {
        console.log(`🔚 Ending all calls in room ${roomId}`);
        this.cleanupRoom(roomId);
        
        // Also remove any active calls for this room
        this.activeCalls.forEach((call, cid) => {
          if (call.roomId === roomId) {
            this.activeCalls.delete(cid);
          }
        });
      }
      
      console.log('✅ Call ended successfully for all participants');
    } catch (error) {
      console.error('❌ End call error:', error);
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
      
      client.to(roomId).emit('offer', {
        offer,
        fromSocketId: client.id,
        roomId
      });
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
      
      client.to(roomId).emit('answer', {
        answer,
        fromSocketId: client.id,
        roomId
      });
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
      
      client.to(roomId).emit('ice-candidate', {
        candidate,
        fromSocketId: client.id,
        roomId
      });
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
      
      // Also notify if user comes online/offline
      if (userId) {
        const targetSocketId = this.userSocketMap.get(userId);
        if (targetSocketId) {
          this.server.to(targetSocketId).emit('user-online-status', {
            userId: this.socketUserMap.get(client.id),
            isOnline: true
          });
        }
      }
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

  @SubscribeMessage('media-frame')
  handleMediaFrame(client: Socket, data: any) {
    try {
      const { roomId, type, frameData, audioData, userId, userName, timestamp } = data;
      
      if (!roomId) {
        console.log('❌ Media frame failed: missing roomId');
        return;
      }

      // Log media frame reception for debugging
      console.log(`📡 Media frame received - Type: ${type}, Room: ${roomId}, From: ${userId}, Size: ${audioData?.length || frameData?.length || 0} bytes`);

      // Broadcast to other users in the same room
      client.to(roomId).emit('media-frame', {
        roomId,
        type,
        frameData,
        audioData,
        userId,
        userName,
        timestamp,
        fromSocketId: client.id
      });

      // Log successful broadcast
      console.log(`📤 Media frame broadcast to room ${roomId} - Type: ${type}`);

    } catch (error) {
      console.error('❌ Media frame error:', error);
    }
  }

  @SubscribeMessage('call-message')
  handleCallMessage(client: Socket, data: any) {
    try {
      const { roomId, message, userId, userName } = data;
      
      if (!roomId || !message) {
        console.log('❌ Call message failed: missing roomId or message');
        return;
      }

      console.log(`💬 Call message in room ${roomId} from ${userName}: ${message}`);
      
      // Broadcast to other users in the room
      client.to(roomId).emit('call-message', {
        roomId,
        message,
        userId,
        userName,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Call message error:', error);
    }
  }

  @SubscribeMessage('debug-media-streaming')
  handleDebugMediaStreaming(client: Socket, data: any) {
    try {
      const { roomId, userId, action } = data;
      
      console.log('🔍 Media Streaming Debug Info:');
      console.log(`- Room: ${roomId}`);
      console.log(`- User: ${userId}`);
      console.log(`- Action: ${action}`);
      console.log(`- Total Rooms: ${this.rooms.size}`);
      console.log(`- Total Connected Users: ${this.userSocketMap.size}`);
      
      if (roomId) {
        const room = this.rooms.get(roomId);
        if (room) {
          console.log(`- Room ${roomId} Participants: ${room.size}`);
          room.forEach((userData, socketId) => {
            console.log(`  - ${userData.userId} (${socketId})`);
          });
        } else {
          console.log(`- Room ${roomId} not found`);
        }
      }

      // Send debug info back to client
      client.emit('debug-media-info', {
        roomCount: this.rooms.size,
        userCount: this.userSocketMap.size,
        roomParticipants: roomId ? Array.from(this.rooms.get(roomId)?.entries() || []) : []
      });

    } catch (error) {
      console.error('❌ Debug media streaming error:', error);
    }
  }

  /**
   * Force end all calls (admin/cleanup function)
   */
  @SubscribeMessage('force-end-all-calls')
  handleForceEndAllCalls(client: Socket, data: any) {
    try {
      console.log('🚨 Force ending all calls');
      
      // End all active calls
      this.activeCalls.forEach((call, callId) => {
        const fromSocketId = this.userSocketMap.get(call.fromUserId);
        const toSocketId = this.userSocketMap.get(call.toUserId);
        
        if (fromSocketId) {
          this.server.to(fromSocketId).emit('call-ended', {
            callId: call.callId,
            roomId: call.roomId,
            reason: 'All calls force ended by system'
          });
        }
        
        if (toSocketId) {
          this.server.to(toSocketId).emit('call-ended', {
            callId: call.callId,
            roomId: call.roomId,
            reason: 'All calls force ended by system'
          });
        }
        
        this.cleanupRoom(call.roomId);
      });
      
      // Clear all active calls
      this.activeCalls.clear();
      
      console.log('✅ All calls force ended');
      client.emit('force-end-complete', { message: 'All calls ended' });
      
    } catch (error) {
      console.error('❌ Force end all calls error:', error);
    }
  }

  /**
   * Get server statistics
   */
  @SubscribeMessage('get-server-stats')
  handleGetServerStats(client: Socket) {
    try {
      const stats = {
        totalConnectedClients: this.server.engine.clientsCount,
        totalRegisteredUsers: this.userSocketMap.size,
        totalActiveRooms: this.rooms.size,
        totalActiveCalls: this.activeCalls.size,
        activeCalls: Array.from(this.activeCalls.entries()).map(([callId, call]) => ({
          callId,
          roomId: call.roomId,
          fromUserId: call.fromUserId,
          toUserId: call.toUserId,
          status: call.status,
          isVideoCall: call.isVideoCall,
          timestamp: call.timestamp
        })),
        rooms: Array.from(this.rooms.entries()).map(([roomId, users]) => ({
          roomId,
          participantCount: users.size,
          participants: Array.from(users.entries()).map(([socketId, userData]) => ({
            socketId,
            userId: userData.userId,
            userName: userData.userName
          }))
        }))
      };

      client.emit('server-stats', stats);
    } catch (error) {
      console.error('❌ Get server stats error:', error);
    }
  }
}