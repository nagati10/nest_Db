import { 
  Injectable, 
  NotFoundException, 
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Offre, OffreDocument } from './schemas/offre.schema';
import { User, UserDocument } from '../User/schemas/user.schema';
import { CreateOffreDto } from './dto/create-offre.dto';
import { UpdateOffreDto } from './dto/update-offre.dto';

@Injectable()
export class OffreService {
  constructor(
    @InjectModel(Offre.name) private offreModel: Model<OffreDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>, // Add UserModel
  ) {}

  async create(
    createOffreDto: CreateOffreDto, 
    user: any, 
    imageFiles?: Express.Multer.File[]
  ): Promise<OffreDocument> {
    try {
      const userId = user._id || user.userId || user.id;
      
      if (!userId) {
        throw new BadRequestException('Invalid user information');
      }

      // Process image files
      const imagePaths = imageFiles?.map(file => `uploads/offres/${file.filename}`) || [];

      // Create the offer
      const offerData = {
        ...createOffreDto,
        images: imagePaths,
        createdBy: new Types.ObjectId(userId),
        isActive: createOffreDto.isActive ?? true,
        viewCount: 0,
        likeCount: 0,
        likedBy: [],
        days: 0,
      };

      const createdOffer = new this.offreModel(offerData);
      return await createdOffer.save();
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Problem au niveau serveur');
    }
  }

  async findAllActive(): Promise<OffreDocument[]> {
    return this.offreModel
      .find({ isActive: true })
      .populate('createdBy', 'nom email image contact modeExamens is_archive TrustXP is_Organization')
      .sort({ createdAt: -1 })
      .exec();
  }

  async searchOffers(query: string): Promise<OffreDocument[]> {
    if (!query || query.trim() === '') {
      return this.findAllActive();
    }

    return this.offreModel
      .find({
        isActive: true,
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { company: { $regex: query, $options: 'i' } },
          { tags: { $in: [new RegExp(query, 'i')] } }
        ]
      })
      .populate('createdBy', 'nom email image contact modeExamens is_archive TrustXP is_Organization')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByTags(tags: string[]): Promise<OffreDocument[]> {
    if (!tags || tags.length === 0) {
      return this.findAllActive();
    }

    return this.offreModel
      .find({
        isActive: true,
        tags: { $in: tags }
      })
      .populate('createdBy', 'nom email image contact modeExamens is_archive TrustXP is_Organization')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByCity(city: string): Promise<OffreDocument[]> {
    return this.offreModel
      .find({
        isActive: true,
        'location.city': { $regex: city, $options: 'i' }
      })
      .populate('createdBy', 'nom email image contact modeExamens is_archive TrustXP is_Organization')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByUser(user: any): Promise<OffreDocument[]> {
    const userId = user._id || user.userId || user.id;
    
    return this.offreModel
      .find({ createdBy: new Types.ObjectId(userId) })
      .populate('createdBy', 'nom email image contact modeExamens is_archive TrustXP is_Organization')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByUserId(userId: string): Promise<OffreDocument[]> {
    return this.offreModel
      .find({ 
        createdBy: new Types.ObjectId(userId),
        isActive: true 
      })
      .populate('createdBy', 'nom email image contact modeExamens is_archive TrustXP is_Organization')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findLikedOffers(user: any): Promise<OffreDocument[]> {
    const userId = user._id || user.userId || user.id;
    
    // Get user's liked offers from user document
    const userDoc = await this.userModel.findById(userId).select('likedOffres').exec();
    
    if (!userDoc || !userDoc.likedOffres || userDoc.likedOffres.length === 0) {
      return [];
    }

    return this.offreModel
      .find({
        _id: { $in: userDoc.likedOffres },
        isActive: true
      })
      .populate('createdBy', 'nom email image contact modeExamens is_archive TrustXP is_Organization')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findPopular(): Promise<OffreDocument[]> {
    return this.offreModel
      .find({ isActive: true })
      .populate('createdBy', 'nom email image contact modeExamens is_archive TrustXP is_Organization')
      .sort({ viewCount: -1, likeCount: -1 })
      .limit(10)
      .exec();
  }

  async findOne(id: string): Promise<OffreDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid offer ID');
    }

    const offer = await this.offreModel
      .findByIdAndUpdate(
        id,
        { $inc: { viewCount: 1 } },
        { new: true }
      )
      .populate('createdBy', 'nom email image contact modeExamens is_archive TrustXP is_Organization')
      .exec();

    if (!offer) {
      throw new NotFoundException(`Offer with ID ${id} not found`);
    }

    return offer;
  }

  async update(
    id: string, 
    updateOffreDto: UpdateOffreDto, 
    user: any
  ): Promise<OffreDocument> {
    const userId = user._id || user.userId || user.id;
    
    // Check if offer exists and user owns it
    const existingOffer = await this.offreModel.findById(id).exec();
    if (!existingOffer) {
      throw new NotFoundException(`Offer with ID ${id} not found`);
    }

    // Check if user is the owner of the offer
    if (existingOffer.createdBy.toString() !== userId.toString()) {
      throw new ForbiddenException('You can only update your own offers');
    }

    const updatedOffer = await this.offreModel
      .findByIdAndUpdate(id, updateOffreDto, { new: true })
      .populate('createdBy', 'nom email image contact modeExamens is_archive TrustXP is_Organization')
      .exec();

    if (!updatedOffer) {
      throw new NotFoundException(`Offer with ID ${id} not found`);
    }

    return updatedOffer;
  }

  async remove(id: string, user: any): Promise<{ message: string }> {
    const userId = user._id || user.userId || user.id;
    
    // Check if offer exists and user owns it
    const existingOffer = await this.offreModel.findById(id).exec();
    if (!existingOffer) {
      throw new NotFoundException(`Offer with ID ${id} not found`);
    }

    // Check if user is the owner of the offer
    if (existingOffer.createdBy.toString() !== userId.toString()) {
      throw new ForbiddenException('You can only delete your own offers');
    }

    const result = await this.offreModel.findByIdAndDelete(id).exec();
    
    if (!result) {
      throw new NotFoundException(`Offer with ID ${id} not found`);
    }

    return { message: 'Offer deleted successfully' };
  }

  async toggleLike(id: string, user: any): Promise<{ liked: boolean; likeCount: number }> {
    const userId = user._id || user.userId || user.id;
    
    const offer = await this.offreModel.findById(id).exec();
    if (!offer) {
      throw new NotFoundException(`Offer with ID ${id} not found`);
    }

    const userObjectId = new Types.ObjectId(userId);
    const isLiked = offer.likedBy.some(like => like.equals(userObjectId));

    let updateQuery;
    if (isLiked) {
      // Unlike
      updateQuery = {
        $pull: { likedBy: userObjectId },
        $inc: { likeCount: -1 }
      };
    } else {
      // Like
      updateQuery = {
        $addToSet: { likedBy: userObjectId },
        $inc: { likeCount: 1 }
      };
    }

    const updatedOffer = await this.offreModel
      .findByIdAndUpdate(id, updateQuery, { new: true })
      .exec();

    if (!updatedOffer) {
      throw new NotFoundException(`Offer with ID ${id} not found`);
    }

    // Also update user's likedOffres array
    await this.updateUserLikedOffres(userId, id, !isLiked);

    return {
      liked: !isLiked,
      likeCount: updatedOffer.likeCount
    };
  }

  private async updateUserLikedOffres(userId: string, offreId: string, add: boolean): Promise<void> {
    try {
      const userObjectId = new Types.ObjectId(userId);
      const offreObjectId = new Types.ObjectId(offreId);
      
      let updateQuery;
      if (add) {
        // Add to user's likedOffres
        updateQuery = {
          $addToSet: { likedOffres: offreObjectId }
        };
      } else {
        // Remove from user's likedOffres
        updateQuery = {
          $pull: { likedOffres: offreObjectId }
        };
      }
      
      await this.userModel.findByIdAndUpdate(userObjectId, updateQuery).exec();
    } catch (error) {
      console.error('Error updating user likedOffres:', error);
      // Don't throw error here to avoid breaking the like operation
    }
  }

  // Additional utility methods
  async getUserOffersCount(userId: string): Promise<number> {
    return this.offreModel
      .countDocuments({ createdBy: new Types.ObjectId(userId) })
      .exec();
  }

  async getOffersStats(): Promise<{ total: number; active: number; popular: number }> {
    const total = await this.offreModel.countDocuments().exec();
    const active = await this.offreModel.countDocuments({ isActive: true }).exec();
    const popular = await this.offreModel.countDocuments({ likeCount: { $gt: 10 } }).exec();

    return { total, active, popular };
  }

  async deactivateExpiredOffers(): Promise<{ deactivated: number }> {
    const result = await this.offreModel
      .updateMany(
        { 
          expiresAt: { $lt: new Date() },
          isActive: true 
        },
        { isActive: false }
      )
      .exec();

    return { deactivated: result.modifiedCount };
  }

  // Helper method to update offer likes (for alternative approach)
  async updateOfferLikes(offreId: string, userId: string, add: boolean): Promise<void> {
    const userObjectId = new Types.ObjectId(userId);
    
    let updateQuery;
    if (add) {
      updateQuery = {
        $addToSet: { likedBy: userObjectId },
        $inc: { likeCount: 1 }
      };
    } else {
      updateQuery = {
        $pull: { likedBy: userObjectId },
        $inc: { likeCount: -1 }
      };
    }
    
    await this.offreModel.findByIdAndUpdate(offreId, updateQuery).exec();
  }
}