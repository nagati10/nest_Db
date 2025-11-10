import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { ResetPasswordDto } from './dto/reset-password-dto';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async create(createUserDto: CreateUserDto, imageFile?: Express.Multer.File): Promise<UserDocument> {
    // Check if email already exists
    const existingUser = await this.userModel.findOne({ 
      email: createUserDto.email 
    });
    
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    
    // Handle image file - ONLY in service
    let imagePath: string | undefined;
    if (imageFile) {
      imagePath = `uploads/${imageFile.filename}`; // Now filename will be defined
    }

    const createdUser = new this.userModel({
      ...createUserDto,
      password: hashedPassword,
      image: imagePath, // Set image path here
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
    const user = await this.userModel
      .findById(id)
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserDocument> {
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
      // If you want to know what was deleted
      const users = await this.userModel.find().exec();
      const result = await this.userModel.deleteMany({}).exec();
      
      console.log(`🗑️ Deleted ${result.deletedCount} users`);
      return {
        message: `Successfully deleted ${result.deletedCount} users`,
        deletedCount: result.deletedCount,
        deletedUsers: users // Optional: include what was deleted
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
    .select('_id') // Only select ID for performance
    .exec();
  
  return !!user;
}
  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    const { email, newPassword } = resetPasswordDto;

    // Find user by email
    const user = await this.findByEmail(email);
    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user's password
    await this.userModel.findByIdAndUpdate(
      user._id,
      { password: hashedPassword },
      { new: true }
    ).exec();

    return { message: 'Password reset successfully' };
  }

}