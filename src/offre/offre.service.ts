// offre.service.ts
import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateOffreDto } from './dto/create-offre.dto';
import { UpdateOffreDto } from './dto/update-offre.dto';
import { Offre, OffreDocument } from './schemas/offre.schema';

@Injectable()
export class OffreService {
  constructor(
    @InjectModel(Offre.name) private offreModel: Model<OffreDocument>,
  ) {}

  async create(createOffreDto: CreateOffreDto, userId: string, imageFile?: Express.Multer.File): Promise<Offre> {
    try {
      // Validate user ID
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid user ID');
      }

      const offreData: any = {
        ...createOffreDto,
        createdBy: new Types.ObjectId(userId), // Use userId from token
      };

      // Handle image file upload
      if (imageFile) {
        offreData.image = `/uploads/offres/${imageFile.filename}`;
      } else {
        // Set default image if none provided
        offreData.image = '/uploads/offres/default-offre.jpg';
      }

      // Set default expiration date if not provided
      if (!offreData.expiresAt) {
        offreData.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      }

      const createdOffre = new this.offreModel(offreData);
      return await createdOffre.save();
    } catch (error) {
      if (error.name === 'ValidationError') {
        throw new BadRequestException('Invalid input data');
      }
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Problem creating offer');
    }
  }

  async findAll(): Promise<Offre[]> {
    try {
      return await this.offreModel
        .find({ isActive: true })
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .exec();
    } catch (error) {
      throw new InternalServerErrorException('Problem fetching offers');
    }
  }

  async findOne(id: string): Promise<Offre> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid offer ID');
    }

    try {
      const offre = await this.offreModel
        .findById(id)
        .populate('createdBy', 'name email')
        .exec();

      if (!offre) {
        throw new NotFoundException(`Offer with ID ${id} not found`);
      }

      // Increment view count
      await this.offreModel.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });

      return offre;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Problem fetching offer');
    }
  }

  async update(id: string, updateOffreDto: UpdateOffreDto, userId: string, imageFile?: Express.Multer.File): Promise<Offre> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid offer ID');
    }

    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    try {
      // First, check if the offer exists and user owns it
      const existingOffre = await this.offreModel.findById(id).exec();
      if (!existingOffre) {
        throw new NotFoundException(`Offer with ID ${id} not found`);
      }

      // Check if user owns the offer
      if (existingOffre.createdBy.toString() !== userId) {
        throw new ForbiddenException('You can only update your own offers');
      }

      const updateData: any = { ...updateOffreDto };

      // Handle image file upload for update
      if (imageFile) {
        updateData.image = `/uploads/offres/${imageFile.filename}`;
      }

      // Remove createdBy from update data to prevent ownership change
      delete updateData.createdBy;

      // Convert location string to object if needed
      if (updateData.location && typeof updateData.location === 'string') {
        updateData.location = JSON.parse(updateData.location);
      }

      // Convert tags string to array if needed
      if (updateData.tags && typeof updateData.tags === 'string') {
        updateData.tags = updateData.tags.split(',').map(tag => tag.trim());
      }

      const updatedOffre = await this.offreModel
        .findByIdAndUpdate(id, { $set: updateData }, { new: true, runValidators: true })
        .populate('createdBy', 'name email')
        .exec();

      if (!updatedOffre) {
        throw new NotFoundException(`Offer with ID ${id} not found after update`);
      }

      return updatedOffre;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      if (error.name === 'ValidationError' || error.name === 'CastError') {
        throw new BadRequestException('Invalid input data');
      }
      throw new InternalServerErrorException('Problem updating offer');
    }
  }

  async remove(id: string, userId?: string): Promise<{ message: string }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid offer ID');
    }

    try {
      // If userId is provided, check ownership (for authenticated users)
      if (userId) {
        if (!Types.ObjectId.isValid(userId)) {
          throw new BadRequestException('Invalid user ID');
        }

        const existingOffre = await this.offreModel.findById(id).exec();
        if (!existingOffre) {
          throw new NotFoundException(`Offer with ID ${id} not found`);
        }
        if (existingOffre.createdBy.toString() !== userId) {
          throw new ForbiddenException('You can only delete your own offers');
        }
      }

      const result = await this.offreModel.findByIdAndDelete(id).exec();

      if (!result) {
        throw new NotFoundException(`Offer with ID ${id} not found`);
      }

      return { message: 'Offer deleted successfully' };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Problem deleting offer');
    }
  }

  async findByTags(tags: string[]): Promise<Offre[]> {
    try {
      return await this.offreModel
        .find({ 
          tags: { $in: tags },
          isActive: true 
        })
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .exec();
    } catch (error) {
      throw new InternalServerErrorException('Problem fetching offers by tags');
    }
  }

  async findByLocation(city: string): Promise<Offre[]> {
    try {
      return await this.offreModel
        .find({ 
          'location.city': new RegExp(city, 'i'),
          isActive: true 
        })
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .exec();
    } catch (error) {
      throw new InternalServerErrorException('Problem fetching offers by location');
    }
  }

  async searchOffres(query: string): Promise<Offre[]> {
    try {
      return await this.offreModel
        .find({
          $and: [
            { isActive: true },
            {
              $or: [
                { title: new RegExp(query, 'i') },
                { description: new RegExp(query, 'i') },
                { tags: new RegExp(query, 'i') },
                { company: new RegExp(query, 'i') },
                { 'location.city': new RegExp(query, 'i') },
                { category: new RegExp(query, 'i') },
              ],
            },
          ],
        })
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .exec();
    } catch (error) {
      throw new InternalServerErrorException('Problem searching offers');
    }
  }

  async findByUser(userId: string): Promise<Offre[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    try {
      return await this.offreModel
        .find({ 
          createdBy: new Types.ObjectId(userId) 
        })
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .exec();
    } catch (error) {
      throw new InternalServerErrorException('Problem fetching user offers');
    }
  }

  async getPopularOffres(limit: number = 10): Promise<Offre[]> {
    try {
      return await this.offreModel
        .find({ isActive: true })
        .sort({ viewCount: -1, createdAt: -1 })
        .limit(limit)
        .populate('createdBy', 'name email')
        .exec();
    } catch (error) {
      throw new InternalServerErrorException('Problem fetching popular offers');
    }
  }

  // Additional method to verify offer ownership
  async verifyOwnership(offerId: string, userId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(offerId) || !Types.ObjectId.isValid(userId)) {
      return false;
    }

    try {
      const offre = await this.offreModel.findById(offerId).exec();
      return !!offre && offre.createdBy.toString() === userId;
    } catch (error) {
      return false;
    }
  }
}