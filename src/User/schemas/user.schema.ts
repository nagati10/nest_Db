import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../enums/role.enum';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, versionKey: false })
export class User {

  @Prop({ required: true })
  nom: string;


  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true, select: false })
  password?: string;
  
  @ApiProperty({ description: 'User role', enum: Role, example: Role.USER })
  @Prop({ type: String, enum: Role, default: Role.USER })
  role: Role;
  
  @Prop({ required: true })
  contact: string;
  
  @Prop({ required: false })
  image?: string;

  @ApiProperty({ description: 'Mode examens activé ou non', example: false })
  @Prop({ type: Boolean, default: false })
  modeExamens: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);