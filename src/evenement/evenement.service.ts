import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Evenement, EvenementDocument } from './schemas/evenement.schema';
import { CreateEvenementDto } from './dto/create-evenement.dto';
import { UpdateEvenementDto } from './dto/update-evenement.dto';

@Injectable()
export class EvenementService {
  constructor(
    @InjectModel(Evenement.name) private evenementModel: Model<EvenementDocument>,
  ) {}

  async create(createEvenementDto: CreateEvenementDto, userId: string): Promise<EvenementDocument> {
    const createdEvenement = new this.evenementModel({
      ...createEvenementDto,
      userId: new Types.ObjectId(userId),
    });
    
    return createdEvenement.save();
  }

  async findAllByUser(userId: string): Promise<Evenement[]> {
    return this.evenementModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ date: 1, heureDebut: 1 })
      .exec();
  }

  async findByUserAndDateRange(userId: string, startDate: string, endDate: string): Promise<Evenement[]> {
    return this.evenementModel
      .find({
        userId: new Types.ObjectId(userId),
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      })
      .sort({ date: 1, heureDebut: 1 })
      .exec();
  }

  async findOne(id: string, userId: string): Promise<EvenementDocument> {
    const evenement = await this.evenementModel.findById(id).exec();
    
    if (!evenement) {
      throw new NotFoundException(`Événement avec ID ${id} non trouvé`);
    }

    // Fix: Convert both to string for consistent comparison
    if (evenement.userId.toString() !== userId.toString()) {
      throw new ForbiddenException('Accès non autorisé à cet événement');
    }

    return evenement;
  }

  async update(id: string, updateEvenementDto: UpdateEvenementDto, userId: string): Promise<EvenementDocument> {
    const evenement = await this.evenementModel.findById(id).exec();
    
    if (!evenement) {
      throw new NotFoundException(`Événement avec ID ${id} non trouvé`);
    }

    // Fix: Convert both to string for consistent comparison
    if (evenement.userId.toString() !== userId.toString()) {
      throw new ForbiddenException('Accès non autorisé à cet événement');
    }

    const updatedEvenement = await this.evenementModel
      .findByIdAndUpdate(id, updateEvenementDto, { new: true })
      .exec();

    if (!updatedEvenement) {
      throw new NotFoundException(`Événement avec ID ${id} non trouvé après mise à jour`);
    }

    return updatedEvenement;
  }

  async remove(id: string, userId: string): Promise<EvenementDocument> {
    const evenement = await this.evenementModel.findById(id).exec();
    
    if (!evenement) {
      throw new NotFoundException(`Événement avec ID ${id} non trouvé`);
    }

    // Fix: Convert both to string for consistent comparison
    if (evenement.userId.toString() !== userId.toString()) {
      throw new ForbiddenException('Accès non autorisé à cet événement');
    }

    const deletedEvenement = await this.evenementModel.findByIdAndDelete(id).exec();
    
    if (!deletedEvenement) {
      throw new NotFoundException(`Événement avec ID ${id} non trouvé après suppression`);
    }

    return deletedEvenement;
  }

  async findByType(userId: string, type: string): Promise<Evenement[]> {
    return this.evenementModel
      .find({
        userId: new Types.ObjectId(userId),
        type: type,
      })
      .sort({ date: 1, heureDebut: 1 })
      .exec();
  }
}