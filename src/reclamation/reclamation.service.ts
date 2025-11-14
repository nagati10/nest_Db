import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Reclamation, ReclamationDocument, ReclamationType } from './schemas/reclamation.schema';
import { CreateReclamationDto } from './dto/create-reclamation.dto';
import { UpdateReclamationDto } from './dto/update-reclamation.dto';

@Injectable()
export class ReclamationService {
  constructor(
    @InjectModel(Reclamation.name) private reclamationModel: Model<ReclamationDocument>,
  ) {}

  async create(createReclamationDto: CreateReclamationDto, userId?: string): Promise<ReclamationDocument> {
    const createdReclamation = new this.reclamationModel({
      ...createReclamationDto,
      date: createReclamationDto.date ? new Date(createReclamationDto.date) : new Date(),
      userId: userId ? new Types.ObjectId(userId) : undefined,
    });
    
    return createdReclamation.save();
  }

  async findAll(): Promise<Reclamation[]> {
    return this.reclamationModel
      .find()
      .populate('userId', 'nom email')
      .sort({ date: -1 })
      .exec();
  }

  async findByUser(userId: string): Promise<Reclamation[]> {
    return this.reclamationModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ date: -1 })
      .exec();
  }

  async findOne(id: string, userId?: string): Promise<ReclamationDocument> {
    const reclamation = await this.reclamationModel.findById(id).populate('userId', 'nom email').exec();
    
    if (!reclamation) {
      throw new NotFoundException(`Réclamation avec ID ${id} non trouvée`);
    }

    // If userId is provided, check if the user owns this reclamation
    if (userId && reclamation.userId && reclamation.userId._id.toString() !== userId) {
      throw new ForbiddenException('Accès non autorisé à cette réclamation');
    }

    return reclamation;
  }

  async update(id: string, updateReclamationDto: UpdateReclamationDto, userId?: string): Promise<ReclamationDocument> {
    const reclamation = await this.reclamationModel.findById(id).exec();
    
    if (!reclamation) {
      throw new NotFoundException(`Réclamation avec ID ${id} non trouvée`);
    }

    // If userId is provided, check if the user owns this reclamation
    if (userId && reclamation.userId && reclamation.userId.toString() !== userId) {
      throw new ForbiddenException('Accès non autorisé à cette réclamation');
    }

    const updateData: any = { ...updateReclamationDto };
    
    // Handle date conversion if provided
    if (updateReclamationDto.date) {
      updateData.date = new Date(updateReclamationDto.date);
    }

    const updatedReclamation = await this.reclamationModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate('userId', 'nom email')
      .exec();

    if (!updatedReclamation) {
      throw new NotFoundException(`Réclamation avec ID ${id} non trouvée après mise à jour`);
    }

    return updatedReclamation;
  }

  async remove(id: string, userId?: string): Promise<ReclamationDocument> {
    const reclamation = await this.reclamationModel.findById(id).exec();
    
    if (!reclamation) {
      throw new NotFoundException(`Réclamation avec ID ${id} non trouvée`);
    }

    // If userId is provided, check if the user owns this reclamation
    if (userId && reclamation.userId && reclamation.userId.toString() !== userId) {
      throw new ForbiddenException('Accès non autorisé à cette réclamation');
    }

    const deletedReclamation = await this.reclamationModel.findByIdAndDelete(id).exec();
    
    if (!deletedReclamation) {
      throw new NotFoundException(`Réclamation avec ID ${id} non trouvée après suppression`);
    }

    return deletedReclamation;
  }

  async findByType(type: ReclamationType): Promise<Reclamation[]> {
    return this.reclamationModel
      .find({ type })
      .populate('userId', 'nom email')
      .sort({ date: -1 })
      .exec();
  }

  async updateStatus(id: string, status: string, userId?: string): Promise<ReclamationDocument> {
    const reclamation = await this.reclamationModel.findById(id).exec();
    
    if (!reclamation) {
      throw new NotFoundException(`Réclamation avec ID ${id} non trouvée`);
    }

    // If userId is provided, check if the user owns this reclamation
    if (userId && reclamation.userId && reclamation.userId.toString() !== userId) {
      throw new ForbiddenException('Accès non autorisé à cette réclamation');
    }

    const updatedReclamation = await this.reclamationModel
      .findByIdAndUpdate(id, { status }, { new: true })
      .populate('userId', 'nom email')
      .exec();

    if (!updatedReclamation) {
      throw new NotFoundException(`Réclamation avec ID ${id} non trouvée après mise à jour du statut`);
    }

    return updatedReclamation;
  }

  async getStats(): Promise<{ type: string; count: number }[]> {
    const result = await this.reclamationModel.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $project: {
          type: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]).exec();

    return result;
  }

  async getStatusStats(): Promise<{ status: string; count: number }[]> {
    const result = await this.reclamationModel.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $project: {
          status: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]).exec();

    return result;
  }
}