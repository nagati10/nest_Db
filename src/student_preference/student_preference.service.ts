import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { StudentPreference, StudentPreferenceDocument } from './schemas/student_preference.schema';
import { CreateStudentPreferenceDto } from './dto/create-student_preference.dto';
import { UpdateStudentPreferenceDto } from './dto/update-student_preference.dto';

@Injectable()
export class StudentPreferenceService {
  constructor(
    @InjectModel(StudentPreference.name) private studentPreferenceModel: Model<StudentPreferenceDocument>,
  ) {}

  async create(createStudentPreferenceDto: CreateStudentPreferenceDto, userId: string): Promise<StudentPreferenceDocument> {
    // Check if preferences already exist for this user
    const existingPreference = await this.studentPreferenceModel.findOne({
      userId: new Types.ObjectId(userId)
    });

    if (existingPreference) {
      throw new ConflictException('Les préférences pour cet utilisateur existent déjà');
    }

    const createdPreference = new this.studentPreferenceModel({
      ...createStudentPreferenceDto,
      userId: new Types.ObjectId(userId),
    });
    
    return createdPreference.save();
  }

  // New method for step-by-step updates
  async updateStep(userId: string, step: number, data: any): Promise<StudentPreferenceDocument> {
    if (step < 1 || step > 5) {
      throw new BadRequestException('Le numéro d\'étape doit être entre 1 et 5');
    }

    let preference = await this.studentPreferenceModel.findOne({
      userId: new Types.ObjectId(userId)
    });
    
    if (!preference) {
      // Create new preference if it doesn't exist
      preference = new this.studentPreferenceModel({
        userId: new Types.ObjectId(userId),
        current_step: step,
        ...data
      });
      await preference.save();
    } else {
      // Update existing preference
      preference = await this.studentPreferenceModel.findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { 
          ...data,
          current_step: step,
          is_completed: step === 5 // Mark as completed when reaching step 5
        },
        { new: true }
      );
    }

    if (!preference) {
      throw new NotFoundException('Préférence non trouvée après mise à jour');
    }

    return preference.populate('userId', 'nom email contact image');
  }

  // Method to complete the entire form
  async completeForm(userId: string, createStudentPreferenceDto: CreateStudentPreferenceDto): Promise<StudentPreferenceDocument> {
    const preference = await this.studentPreferenceModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        ...createStudentPreferenceDto,
        current_step: 5,
        is_completed: true
      },
      { new: true, upsert: true } // Create if doesn't exist
    ).populate('userId', 'nom email contact image');

    return preference;
  }

  async findAll(): Promise<StudentPreference[]> {
    return this.studentPreferenceModel
      .find()
      .populate('userId', 'nom email contact image')
      .exec();
  }

  async findOne(id: string): Promise<StudentPreferenceDocument> {
    const preference = await this.studentPreferenceModel
      .findById(id)
      .populate('userId', 'nom email contact image')
      .exec();
    
    if (!preference) {
      throw new NotFoundException(`Préférence étudiant avec ID ${id} non trouvée`);
    }

    return preference;
  }

  async findByUser(userId: string): Promise<StudentPreferenceDocument> {
    const preference = await this.studentPreferenceModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .populate('userId', 'nom email contact image')
      .exec();
    
    if (!preference) {
      throw new NotFoundException(`Préférence étudiant non trouvée pour cet utilisateur`);
    }

    return preference;
  }

  async update(id: string, updateStudentPreferenceDto: UpdateStudentPreferenceDto, userId: string): Promise<StudentPreferenceDocument> {
    const preference = await this.studentPreferenceModel.findById(id).exec();
    
    if (!preference) {
      throw new NotFoundException(`Préférence étudiant avec ID ${id} non trouvée`);
    }

    // Check if the user owns this preference
    if (preference.userId.toString() !== userId) {
      throw new ForbiddenException('Accès non autorisé à ces préférences');
    }

    const updatedPreference = await this.studentPreferenceModel
      .findByIdAndUpdate(id, updateStudentPreferenceDto, { new: true })
      .populate('userId', 'nom email contact image')
      .exec();

    if (!updatedPreference) {
      throw new NotFoundException(`Préférence étudiant avec ID ${id} non trouvée après mise à jour`);
    }

    return updatedPreference;
  }

  async updateByUser(userId: string, updateStudentPreferenceDto: UpdateStudentPreferenceDto): Promise<StudentPreferenceDocument> {
    const updatedPreference = await this.studentPreferenceModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId) }, 
        updateStudentPreferenceDto, 
        { new: true, upsert: true }
      )
      .populate('userId', 'nom email contact image')
      .exec();

    if (!updatedPreference) {
      throw new NotFoundException(`Préférence étudiant non trouvée après mise à jour`);
    }

    return updatedPreference;
  }

  async remove(id: string, userId: string): Promise<StudentPreferenceDocument> {
    const preference = await this.studentPreferenceModel.findById(id).exec();
    
    if (!preference) {
      throw new NotFoundException(`Préférence étudiant avec ID ${id} non trouvée`);
    }

    if (preference.userId.toString() !== userId) {
      throw new ForbiddenException('Accès non autorisé à ces préférences');
    }

    const deletedPreference = await this.studentPreferenceModel.findByIdAndDelete(id).exec();
    
    if (!deletedPreference) {
      throw new NotFoundException(`Préférence étudiant avec ID ${id} non trouvée après suppression`);
    }

    return deletedPreference;
  }

  async removeByUser(userId: string): Promise<StudentPreferenceDocument> {
    const preference = await this.studentPreferenceModel
      .findOneAndDelete({ userId: new Types.ObjectId(userId) })
      .exec();
    
    if (!preference) {
      throw new NotFoundException(`Préférence étudiant non trouvée pour cet utilisateur`);
    }

    return preference;
  }

  // Statistics methods
  async count(): Promise<number> {
    return this.studentPreferenceModel.countDocuments().exec();
  }

  async countCompleted(): Promise<number> {
    return this.studentPreferenceModel.countDocuments({ is_completed: true }).exec();
  }

  async getStatsByStudyLevel(): Promise<{ level: string; count: number }[]> {
    const result = await this.studentPreferenceModel.aggregate([
      {
        $group: {
          _id: '$study_level',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $project: {
          level: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]).exec();

    return result;
  }

  async getStatsByStudyDomain(): Promise<{ domain: string; count: number }[]> {
    const result = await this.studentPreferenceModel.aggregate([
      {
        $group: {
          _id: '$study_domain',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $project: {
          domain: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]).exec();

    return result;
  }

  async getStatsByLookingFor(): Promise<{ lookingFor: string; count: number }[]> {
    const result = await this.studentPreferenceModel.aggregate([
      {
        $group: {
          _id: '$looking_for',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $project: {
          lookingFor: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]).exec();

    return result;
  }

  async getStatsBySoftSkills(): Promise<{ skill: string; count: number }[]> {
    const result = await this.studentPreferenceModel.aggregate([
      { $unwind: '$soft_skills' },
      {
        $group: {
          _id: '$soft_skills',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $project: {
          skill: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]).exec();

    return result;
  }

  async getStatsByLanguage(language: string): Promise<{ level: string; count: number }[]> {
    const fieldMap: { [key: string]: string } = {
      'arabe': 'langue_arabe',
      'francais': 'langue_francais',
      'anglais': 'langue_anglais'
    };

    const fieldName = fieldMap[language];
    
    if (!fieldName) {
      throw new BadRequestException('Langue non supportée. Utilisez: arabe, francais, anglais');
    }

    const result = await this.studentPreferenceModel.aggregate([
      {
        $group: {
          _id: `$${fieldName}`,
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $project: {
          level: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]).exec();

    return result;
  }

  async findByCriteria(criteria: any): Promise<StudentPreference[]> {
    const query: any = {};

    if (criteria.study_level) query.study_level = criteria.study_level;
    if (criteria.study_domain) query.study_domain = criteria.study_domain;
    if (criteria.looking_for) query.looking_for = criteria.looking_for;
    if (criteria.main_motivation) query.main_motivation = criteria.main_motivation;
    if (criteria.soft_skills) query.soft_skills = { $in: criteria.soft_skills };

    return this.studentPreferenceModel
      .find(query)
      .populate('userId', 'nom email contact image')
      .exec();
  }

  // New method to get form progress
  async getFormProgress(userId: string): Promise<{ current_step: number; is_completed: boolean }> {
    const preference = await this.studentPreferenceModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .select('current_step is_completed')
      .exec();
    
    if (!preference) {
      return { current_step: 1, is_completed: false };
    }

    return {
      current_step: preference.current_step,
      is_completed: preference.is_completed
    };
  }
}