import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Avis, AvisDocument } from './schemas/avi.schemas';
import { CreateAvisDto } from './dto/create-avi.dto';
import { UpdateAviDto } from './dto/update-avi.dto';

@Injectable()
export class AvisService {
  constructor(
    @InjectModel(Avis.name) private avisModel: Model<AvisDocument>,
  ) {}

  async create(createAvisDto: CreateAvisDto, userId: string): Promise<AvisDocument> {
    const createdAvis = new this.avisModel({
      ...createAvisDto,
      date: createAvisDto.date ? new Date(createAvisDto.date) : new Date(),
      userId: new Types.ObjectId(userId),
    });
    
    return createdAvis.save();
  }

  async findAll(): Promise<Avis[]> {
    return this.avisModel
      .find()
      .populate('userId', 'nom email')
      .sort({ date: -1 })
      .exec();
  }

  async findAllByUser(userId: string): Promise<Avis[]> {
    return this.avisModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ date: -1 })
      .exec();
  }

  async findOne(id: string, userId?: string): Promise<AvisDocument> {
    const avis = await this.avisModel.findById(id).populate('userId', 'nom email').exec();
    
    if (!avis) {
      throw new NotFoundException(`Avis avec ID ${id} non trouvé`);
    }

    // If userId is provided, check if the user owns this avis
    if (userId && avis.userId && avis.userId._id.toString() !== userId.toString()) {
      throw new ForbiddenException('Accès non autorisé à cet avis');
    }

    return avis;
  }

  async update(id: string, updateAvisDto: UpdateAviDto, userId?: string): Promise<AvisDocument> {
    const avis = await this.avisModel.findById(id).exec();
    
    if (!avis) {
      throw new NotFoundException(`Avis avec ID ${id} non trouvé`);
    }

    // If userId is provided, check if the user owns this avis
    if (userId && avis.userId && avis.userId.toString() !== userId.toString()) {
      throw new ForbiddenException('Accès non autorisé à cet avis');
    }

    const updateData: any = { ...updateAvisDto };
    
    // Handle date conversion if provided
    if (updateAvisDto.date) {
      updateData.date = new Date(updateAvisDto.date);
    }

    const updatedAvis = await this.avisModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate('userId', 'nom email')
      .exec();

    if (!updatedAvis) {
      throw new NotFoundException(`Avis avec ID ${id} non trouvé après mise à jour`);
    }

    return updatedAvis;
  }

  async remove(id: string, userId?: string): Promise<AvisDocument> {
    const avis = await this.avisModel.findById(id).exec();
    
    if (!avis) {
      throw new NotFoundException(`Avis avec ID ${id} non trouvé`);
    }

    // If userId is provided, check if the user owns this avis
    if (userId && avis.userId && avis.userId.toString() !== userId.toString()) {
      throw new ForbiddenException('Accès non autorisé à cet avis');
    }

    const deletedAvis = await this.avisModel.findByIdAndDelete(id).exec();
    
    if (!deletedAvis) {
      throw new NotFoundException(`Avis avec ID ${id} non trouvé après suppression`);
    }

    return deletedAvis;
  }

  async findByRating(minRating: number, maxRating: number = 5): Promise<Avis[]> {
    return this.avisModel
      .find({
        rating: { $gte: minRating, $lte: maxRating }
      })
      .populate('userId', 'nom email')
      .sort({ rating: -1, date: -1 })
      .exec();
  }

  async findAnonymes(isAnonyme: boolean = true): Promise<Avis[]> {
    return this.avisModel
      .find({ is_Anonyme: isAnonyme })
      .populate('userId', 'nom email')
      .sort({ date: -1 })
      .exec();
  }

  async findByUserRating(userId: string, minRating: number, maxRating: number = 5): Promise<Avis[]> {
    return this.avisModel
      .find({
        userId: new Types.ObjectId(userId),
        rating: { $gte: minRating, $lte: maxRating }
      })
      .sort({ rating: -1, date: -1 })
      .exec();
  }

  async getAverageRating(): Promise<{ average: number; count: number }> {
    const result = await this.avisModel.aggregate([
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          count: { $sum: 1 }
        }
      }
    ]).exec();

    if (result.length === 0) {
      return { average: 0, count: 0 };
    }

    return {
      average: Math.round(result[0].averageRating * 10) / 10, // Round to 1 decimal
      count: result[0].count
    };
  }

  async getRatingDistribution(): Promise<{ rating: number; count: number }[]> {
    const result = await this.avisModel.aggregate([
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      },
      {
        $project: {
          rating: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]).exec();

    return result;
  }
}