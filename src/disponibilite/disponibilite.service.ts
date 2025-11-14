import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Disponibilite, DisponibiliteDocument, JourSemaine } from './schemas/disponibilite.schema';
import { CreateDisponibiliteDto } from './dto/create-disponibilite.dto';
import { UpdateDisponibiliteDto } from './dto/update-disponibilite.dto';

@Injectable()
export class DisponibiliteService {
  constructor(
    @InjectModel(Disponibilite.name) private disponibiliteModel: Model<DisponibiliteDocument>,
  ) {}

  async create(createDisponibiliteDto: CreateDisponibiliteDto, userId: string): Promise<DisponibiliteDocument> {
    // Check if availability already exists for this day and user
    const existingDisponibilite = await this.disponibiliteModel.findOne({
      userId: new Types.ObjectId(userId),
      jour: createDisponibiliteDto.jour,
    });

    if (existingDisponibilite) {
      throw new ConflictException('Disponibilité déjà existante pour ce jour');
    }

    const createdDisponibilite = new this.disponibiliteModel({
      ...createDisponibiliteDto,
      userId: new Types.ObjectId(userId),
    });
    
    return createdDisponibilite.save();
  }

  async findAllByUser(userId: string): Promise<Disponibilite[]> {
    return this.disponibiliteModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ 
        jour: 1,
        heureDebut: 1 
      })
      .exec();
  }

  async findOne(id: string, userId: string): Promise<DisponibiliteDocument> {
    const disponibilite = await this.disponibiliteModel.findById(id).exec();
    
    if (!disponibilite) {
      throw new NotFoundException(`Disponibilité avec ID ${id} non trouvée`);
    }

    if (disponibilite.userId.toString() !== userId) {
      throw new ForbiddenException('Accès non autorisé à cette disponibilité');
    }

    return disponibilite;
  }

  async update(id: string, updateDisponibiliteDto: UpdateDisponibiliteDto, userId: string): Promise<DisponibiliteDocument> {
    const disponibilite = await this.disponibiliteModel.findById(id).exec();
    
    if (!disponibilite) {
      throw new NotFoundException(`Disponibilité avec ID ${id} non trouvée`);
    }

    if (disponibilite.userId.toString() !== userId) {
      throw new ForbiddenException('Accès non autorisé à cette disponibilité');
    }

    const updatedDisponibilite = await this.disponibiliteModel
      .findByIdAndUpdate(id, updateDisponibiliteDto, { new: true })
      .exec();

    // Add null check after update
    if (!updatedDisponibilite) {
      throw new NotFoundException(`Disponibilité avec ID ${id} non trouvée après mise à jour`);
    }

    return updatedDisponibilite;
  }

  async remove(id: string, userId: string): Promise<DisponibiliteDocument> {
    const disponibilite = await this.disponibiliteModel.findById(id).exec();
    
    if (!disponibilite) {
      throw new NotFoundException(`Disponibilité avec ID ${id} non trouvée`);
    }

    if (disponibilite.userId.toString() !== userId) {
      throw new ForbiddenException('Accès non autorisé à cette disponibilité');
    }

    const deletedDisponibilite = await this.disponibiliteModel.findByIdAndDelete(id).exec();
    
    // Add null check after deletion
    if (!deletedDisponibilite) {
      throw new NotFoundException(`Disponibilité avec ID ${id} non trouvée après suppression`);
    }

    return deletedDisponibilite;
  }

  async findByJour(userId: string, jour: JourSemaine): Promise<Disponibilite[]> {
    return this.disponibiliteModel
      .find({
        userId: new Types.ObjectId(userId),
        jour: jour,
      })
      .sort({ heureDebut: 1 })
      .exec();
  }

  async removeAllByUser(userId: string): Promise<{ deletedCount: number }> {
    const result = await this.disponibiliteModel
      .deleteMany({ userId: new Types.ObjectId(userId) })
      .exec();
    
    return { deletedCount: result.deletedCount };
  }
}