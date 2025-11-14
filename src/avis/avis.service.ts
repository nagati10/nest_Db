import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Avis, AvisDocument } from './schemas/avi.schemas';
import { CreateAvisDto } from './dto/create-avi.dto';
import { UpdateAviDto } from './dto/update-avi.dto';

@Injectable()
export class AvisService {
  constructor(
    @InjectModel(Avis.name) private avisModel: Model<AvisDocument>,
  ) {}

  async create(createAvisDto: CreateAvisDto): Promise<AvisDocument> {
    const createdAvis = new this.avisModel({
      ...createAvisDto,
      date: createAvisDto.date ? new Date(createAvisDto.date) : new Date(),
    });
    
    return createdAvis.save();
  }

  async findAll(): Promise<Avis[]> {
    return this.avisModel
      .find()
      .sort({ date: -1 })
      .exec();
  }

  async findOne(id: string): Promise<AvisDocument> {
    const avis = await this.avisModel.findById(id).exec();
    
    if (!avis) {
      throw new NotFoundException(`Avis avec ID ${id} non trouvé`);
    }

    return avis;
  }

  async update(id: string, updateAvisDto: UpdateAviDto): Promise<AvisDocument> {
    const avis = await this.avisModel.findById(id).exec();
    
    if (!avis) {
      throw new NotFoundException(`Avis avec ID ${id} non trouvé`);
    }

    const updateData: any = { ...updateAvisDto };
    
    // Handle date conversion if provided
    if (updateAvisDto.date) {
      updateData.date = new Date(updateAvisDto.date);
    }

    const updatedAvis = await this.avisModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();

    if (!updatedAvis) {
      throw new NotFoundException(`Avis avec ID ${id} non trouvé après mise à jour`);
    }

    return updatedAvis;
  }

  async remove(id: string): Promise<AvisDocument> {
    const avis = await this.avisModel.findById(id).exec();
    
    if (!avis) {
      throw new NotFoundException(`Avis avec ID ${id} non trouvé`);
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
      .sort({ rating: -1, date: -1 })
      .exec();
  }

  async findAnonymes(isAnonyme: boolean = true): Promise<Avis[]> {
    return this.avisModel
      .find({ is_Anonyme: isAnonyme })
      .sort({ date: -1 })
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