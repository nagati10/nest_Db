// src/chat/chat.service.ts
import { 
  Injectable, 
  NotFoundException, 
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chat, ChatDocument } from './schemas/chat.schema';
import { Message, MessageDocument, MessageType } from './schemas/message.schema';
import { User, UserDocument } from '../User/schemas/user.schema';
import { Offre, OffreDocument } from '../offre/schemas/offre.schema';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateChatDto } from './dto/update-chat.dto';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Offre.name) private offreModel: Model<OffreDocument>,
  ) {}

  async createOrGetChat(createChatDto: CreateChatDto, candidateId: string): Promise<ChatDocument> {
    try {
      const { entreprise, offer } = createChatDto;

      // Validate users and offer exist
      const [entrepriseUser, offerDoc, candidateUser] = await Promise.all([
        this.userModel.findById(entreprise).exec(),
        this.offreModel.findById(offer).exec(),
        this.userModel.findById(candidateId).exec(),
      ]);

      if (!entrepriseUser || !candidateUser) {
        throw new NotFoundException('User not found');
      }

      if (!offerDoc) {
        throw new NotFoundException('Offer not found');
      }

      // Check if user is blocked from this offer
      if (offerDoc.blockedUsers?.includes(new Types.ObjectId(candidateId))) {
        throw new ForbiddenException('You are blocked from this offer');
      }

      // Check if chat already exists
      const existingChat = await this.chatModel.findOne({
        candidate: new Types.ObjectId(candidateId),
        entreprise: new Types.ObjectId(entreprise),
        offer: new Types.ObjectId(offer),
        isDeleted: false
      }).exec();

      if (existingChat) {
        return existingChat;
      }

      // Create new chat
      const chatData = {
        candidate: new Types.ObjectId(candidateId),
        entreprise: new Types.ObjectId(entreprise),
        offer: new Types.ObjectId(offer),
        lastActivity: new Date(),
        isAccepted: false
      };

      const createdChat = new this.chatModel(chatData);
      return await createdChat.save();
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Problem creating chat');
    }
  }

async sendMessage(chatId: string, senderId: string, sendMessageDto: SendMessageDto): Promise<MessageDocument> {
  try {
    // Find chat and validate
    const chat = await this.chatModel.findById(chatId).exec();
    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    if (chat.isBlocked) {
      throw new ForbiddenException('This chat is blocked');
    }

    if (chat.isDeleted) {
      throw new ForbiddenException('This chat is deleted');
    }

    // Verify sender is participant
    const senderObjectId = new Types.ObjectId(senderId);
    if (!chat.candidate.equals(senderObjectId) && !chat.entreprise.equals(senderObjectId)) {
      throw new ForbiddenException('You are not a participant in this chat');
    }

    // Create message
    const messageData = {
      chat: new Types.ObjectId(chatId),
      sender: senderObjectId,
      ...sendMessageDto
    };

    const createdMessage = new this.messageModel(messageData);
    const savedMessage = await createdMessage.save();

    // Update chat last activity and last message
    const lastMessage = sendMessageDto.type === MessageType.TEXT 
      ? sendMessageDto.content 
      : `${sendMessageDto.type} message`;

    await this.chatModel.findByIdAndUpdate(chatId, {
      lastActivity: new Date(),
      lastMessage: lastMessage?.substring(0, 100),
      lastMessageType: sendMessageDto.type,
      $inc: {
        unreadCandidate: chat.entreprise.equals(senderObjectId) ? 1 : 0,
        unreadEntreprise: chat.candidate.equals(senderObjectId) ? 1 : 0
      }
    }).exec();

    // Return the populated message
    const populatedMessage = await this.messageModel
      .findById(savedMessage._id)
      .populate('sender', 'nom email image')
      .exec();

    if (!populatedMessage) {
      throw new InternalServerErrorException('Failed to retrieve sent message');
    }

    return populatedMessage;
  } catch (error) {
    if (error instanceof NotFoundException || error instanceof ForbiddenException) {
      throw error;
    }
    throw new InternalServerErrorException('Problem sending message');
  }
}

  async getChatMessages(chatId: string, userId: string, page: number = 1, limit: number = 50): Promise<{ messages: MessageDocument[], total: number }> {
    try {
      // Verify user has access to chat
      const chat = await this.chatModel.findOne({
        _id: chatId,
        $or: [
          { candidate: new Types.ObjectId(userId) },
          { entreprise: new Types.ObjectId(userId) }
        ]
      }).exec();

      if (!chat) {
        throw new NotFoundException('Chat not found or access denied');
      }

      const skip = (page - 1) * limit;

      const [messages, total] = await Promise.all([
        this.messageModel
          .find({ 
            chat: new Types.ObjectId(chatId),
            isDeleted: false
          })
          .populate('sender', 'nom email image')
          .populate('replyTo', 'content type sender')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .exec(),
        this.messageModel.countDocuments({ 
          chat: new Types.ObjectId(chatId),
          isDeleted: false
        }).exec()
      ]);

      // Mark messages as read if they are for this user
      const userObjectId = new Types.ObjectId(userId);
      const unreadField = chat.candidate.equals(userObjectId) ? 'unreadCandidate' : 'unreadEntreprise';
      
      if (chat[unreadField] > 0) {
        await this.chatModel.findByIdAndUpdate(chatId, {
          [unreadField]: 0
        }).exec();

        // Mark messages as read
        await this.messageModel.updateMany(
          {
            chat: new Types.ObjectId(chatId),
            sender: { $ne: userObjectId },
            isRead: false
          },
          {
            isRead: true,
            readAt: new Date()
          }
        ).exec();
      }

      return {
        messages: messages.reverse(), // Return in chronological order
        total
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Problem fetching messages');
    }
  }

  async getUserChats(userId: string): Promise<ChatDocument[]> {
    try {
      return await this.chatModel
        .find({
          $or: [
            { candidate: new Types.ObjectId(userId) },
            { entreprise: new Types.ObjectId(userId) }
          ],
          isDeleted: false
        })
        .populate('candidate', 'nom email image contact')
        .populate('entreprise', 'nom email image contact is_Organization')
        .populate('offer', 'title company salary jobType')
        .sort({ lastActivity: -1 })
        .exec();
    } catch (error) {
      throw new InternalServerErrorException('Problem fetching chats');
    }
  }

  async blockChat(chatId: string, userId: string, reason?: string): Promise<ChatDocument> {
    try {
      const chat = await this.chatModel.findById(chatId).exec();
      if (!chat) {
        throw new NotFoundException('Chat not found');
      }

      // Verify user is entreprise (only entreprise can block)
      if (!chat.entreprise.equals(new Types.ObjectId(userId))) {
        throw new ForbiddenException('Only entreprise can block chats');
      }

      // Also add user to offer's blocked users
      await this.offreModel.findByIdAndUpdate(
        chat.offer,
        { $addToSet: { blockedUsers: chat.candidate } }
      ).exec();

      const updatedChat = await this.chatModel
        .findByIdAndUpdate(
          chatId,
          {
            isBlocked: true,
            blockedBy: new Types.ObjectId(userId),
            blockReason: reason || 'No reason provided'
          },
          { new: true }
        )
        .populate('candidate', 'nom email image')
        .populate('entreprise', 'nom email image')
        .populate('offer', 'title company')
        .exec();

      if (!updatedChat) {
        throw new NotFoundException('Chat not found after update');
      }

      return updatedChat;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Problem blocking chat');
    }
  }

  async unblockChat(chatId: string, userId: string): Promise<ChatDocument> {
    try {
      const chat = await this.chatModel.findById(chatId).exec();
      if (!chat) {
        throw new NotFoundException('Chat not found');
      }

      if (!chat.entreprise.equals(new Types.ObjectId(userId))) {
        throw new ForbiddenException('Only entreprise can unblock chats');
      }

      // Remove user from offer's blocked users
      await this.offreModel.findByIdAndUpdate(
        chat.offer,
        { $pull: { blockedUsers: chat.candidate } }
      ).exec();

      const updatedChat = await this.chatModel
        .findByIdAndUpdate(
          chatId,
          {
            isBlocked: false,
            blockedBy: null,
            blockReason: null
          },
          { new: true }
        )
        .populate('candidate', 'nom email image')
        .populate('entreprise', 'nom email image')
        .populate('offer', 'title company')
        .exec();

      if (!updatedChat) {
        throw new NotFoundException('Chat not found after update');
      }

      return updatedChat;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Problem unblocking chat');
    }
  }

  async acceptCandidate(chatId: string, userId: string): Promise<ChatDocument> {
    try {
      const chat = await this.chatModel.findById(chatId).exec();
      if (!chat) {
        throw new NotFoundException('Chat not found');
      }

      // Verify user is entreprise
      if (!chat.entreprise.equals(new Types.ObjectId(userId))) {
        throw new ForbiddenException('Only entreprise can accept candidates');
      }

      // Add candidate to offer's accepted users
      await this.offreModel.findByIdAndUpdate(
        chat.offer,
        { $addToSet: { acceptedUsers: chat.candidate } }
      ).exec();

      const updatedChat = await this.chatModel
        .findByIdAndUpdate(
          chatId,
          {
            isAccepted: true,
            acceptedAt: new Date()
          },
          { new: true }
        )
        .populate('candidate', 'nom email image contact')
        .populate('entreprise', 'nom email image')
        .populate('offer', 'title company')
        .exec();

      if (!updatedChat) {
        throw new NotFoundException('Chat not found after update');
      }

      return updatedChat;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Problem accepting candidate');
    }
  }

  async canMakeCall(offerId: string, userId: string): Promise<boolean> {
    try {
      const offer = await this.offreModel.findById(offerId).exec();
      if (!offer) {
        throw new NotFoundException('Offer not found');
      }

      // Check if user is accepted for this offer
      return offer.acceptedUsers?.some(acceptedUserId => 
        acceptedUserId.equals(new Types.ObjectId(userId))
      ) || false;
    } catch (error) {
      throw new InternalServerErrorException('Problem checking call permission');
    }
  }

  async deleteChat(chatId: string, userId: string): Promise<{ message: string }> {
    try {
      const chat = await this.chatModel.findById(chatId).exec();
      if (!chat) {
        throw new NotFoundException('Chat not found');
      }

      // Verify user is participant
      const userObjectId = new Types.ObjectId(userId);
      if (!chat.candidate.equals(userObjectId) && !chat.entreprise.equals(userObjectId)) {
        throw new ForbiddenException('You are not a participant in this chat');
      }

      await this.chatModel.findByIdAndUpdate(chatId, {
        isDeleted: true,
        deletedBy: userObjectId
      }).exec();

      return { message: 'Chat deleted successfully' };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Problem deleting chat');
    }
  }

  async getChatById(chatId: string, userId: string): Promise<ChatDocument> {
    try {
      const chat = await this.chatModel
        .findOne({
          _id: chatId,
          $or: [
            { candidate: new Types.ObjectId(userId) },
            { entreprise: new Types.ObjectId(userId) }
          ],
          isDeleted: false
        })
        .populate('candidate', 'nom email image contact')
        .populate('entreprise', 'nom email image contact is_Organization')
        .populate('offer', 'title company salary jobType location')
        .exec();

      if (!chat) {
        throw new NotFoundException('Chat not found');
      }

      return chat;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Problem fetching chat');
    }
  }

  async markMessagesAsRead(chatId: string, userId: string): Promise<{ message: string }> {
  try {
    const chat = await this.chatModel.findById(chatId).exec();
    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    // Verify user has access to chat
    const userObjectId = new Types.ObjectId(userId);
    if (!chat.candidate.equals(userObjectId) && !chat.entreprise.equals(userObjectId)) {
      throw new ForbiddenException('You are not a participant in this chat');
    }

    // Reset unread count for this user
    const unreadField = chat.candidate.equals(userObjectId) ? 'unreadCandidate' : 'unreadEntreprise';
    
    await this.chatModel.findByIdAndUpdate(chatId, {
      [unreadField]: 0
    }).exec();

    // Mark messages as read
    await this.messageModel.updateMany(
      {
        chat: new Types.ObjectId(chatId),
        sender: { $ne: userObjectId },
        isRead: false
      },
      {
        isRead: true,
        readAt: new Date()
      }
    ).exec();

    return { message: 'Messages marked as read' };
  } catch (error) {
    if (error instanceof NotFoundException || error instanceof ForbiddenException) {
      throw error;
    }
    throw new InternalServerErrorException('Problem marking messages as read');
  }
}
}