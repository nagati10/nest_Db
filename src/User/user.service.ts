import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { ResetPasswordDto } from './dto/reset-password-dto';
import { CreateProfileFromCvDto } from './dto/create-profile-from-cv.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async create(
    createUserDto: CreateUserDto,
    imageFile?: Express.Multer.File,
  ): Promise<UserDocument> {
    const existingUser = await this.userModel.findOne({
      email: createUserDto.email,
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    let imagePath: string | undefined;
    if (imageFile) {
      imagePath = `uploads/${imageFile.filename}`;
    }

    const createdUser = new this.userModel({
      ...createUserDto,
      password: hashedPassword,
      image: imagePath,
    });

    return createdUser.save();
  }

  async findAll(): Promise<User[]> {
    return this.userModel.find().exec();
  }

  async findOne(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async getProfile(id: string): Promise<User | null> {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(id, updateUserDto, { new: true })
      .exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async remove(id: string): Promise<UserDocument> {
    const user = await this.userModel.findByIdAndDelete(id).exec();

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async empty() {
    try {
      const users = await this.userModel.find().exec();
      const result = await this.userModel.deleteMany({}).exec();

      return {
        message: `Successfully deleted ${result.deletedCount} users`,
        deletedCount: result.deletedCount,
        deletedUsers: users,
      };
    } catch (error) {
      console.error('Error emptying users:', error);
      throw new Error('Failed to delete users');
    }
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).select('+password').exec();
  }

  async updateImage(userId: string, imagePath: string): Promise<User> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    user.image = imagePath;
    return user.save();
  }

  async checkEmailExists(email: string): Promise<boolean> {
    const user = await this.userModel
      .findOne({ email: email.toLowerCase().trim() })
      .select('_id')
      .exec();

    return !!user;
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    const { email, newPassword } = resetPasswordDto;

    const user = await this.findByEmail(email);
    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.userModel
      .findByIdAndUpdate(user._id, { password: hashedPassword }, { new: true })
      .exec();

    return { message: 'Password reset successfully' };
  }

  async toggleExamMode(userId: string): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    user.modeExamens = !user.modeExamens;
    return user.save();
  }

  async switchArchiveState(userId: string): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    user.is_archive = !user.is_archive;
    return user.save();
  }

  async levelUp(userId: string, xp: number): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    user.TrustXP += xp;
    return user.save();
  }

  async levelDown(userId: string, xp: number): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    user.TrustXP = Math.max(0, user.TrustXP - xp);
    return user.save();
  }

  async getTrustLevel(
    userId: string,
  ): Promise<{ level: number; text: string }> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const trustLevels = [
      { threshold: 0, text: 'NotRecommended' },
      { threshold: 10, text: 'Beginner' },
      { threshold: 100, text: 'Intermediate' },
      { threshold: 1000, text: 'Advanced' },
      { threshold: 10000, text: 'Expert' },
      { threshold: 100000, text: 'Master' },
      { threshold: 1000000, text: 'Legend' },
    ];

    let level = 0;
    let levelText = 'NotRecommended';

    for (let i = trustLevels.length - 1; i >= 0; i--) {
      if (user.TrustXP >= trustLevels[i].threshold) {
        level = i;
        levelText = trustLevels[i].text;
        break;
      }
    }

    return {
      level,
      text: levelText,
    };
  }

  async toggleOrganization(userId: string): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    user.is_Organization = !user.is_Organization;
    return user.save();
  }

  async addLikedOffre(
    userId: string,
    offreId: string,
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (!user.likedOffres.includes(new Types.ObjectId(offreId))) {
      user.likedOffres.push(new Types.ObjectId(offreId));
    }

    return user.save();
  }

  async removeLikedOffre(
    userId: string,
    offreId: string,
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    user.likedOffres = user.likedOffres.filter(
      (id) => id.toString() !== offreId,
    );

    return user.save();
  }

  async getLikedOffres(userId: string): Promise<Types.ObjectId[]> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return user.likedOffres;
  }

  async isOffreLiked(userId: string, offreId: string): Promise<boolean> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return user.likedOffres.some((id) => id.toString() === offreId);
  }

  // --------- PROFIL À PARTIR DU CV IA ----------
  async createOrUpdateProfileFromCv(
    userId: string,
    cv: CreateProfileFromCvDto,
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (cv.name) user.nom = cv.name;
    if (cv.email) user.email = cv.email;
    if (cv.phone) user.contact = cv.phone;

    user.cvExperience = cv.experience ?? [];
    user.cvEducation = cv.education ?? [];
    user.cvSkills = cv.skills ?? [];

    await user.save();
    return user;
  }
}
