import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type OffreDocument = HydratedDocument<Offre>;

export enum JobType {
  JOB = 'job',
  STAGE = 'stage',
  FREELANCE = 'freelance'
}

export enum Shift {
  JOUR = 'jour',
  NUIT = 'nuit',
  FLEXIBLE = 'flexible'
}

@Schema({ timestamps: true, versionKey: false })
export class Offre {
  @ApiProperty({ example: 'Senior Developer', description: 'Title of the offer' })
  @Prop({ required: true })
  title: string;

  @ApiProperty({ 
    example: ['/uploads/offres/image1.jpg', '/uploads/offres/image2.jpg'], 
    description: 'Array of offer image URLs' 
  })
  @Prop({ required: true })
  images: string[];

  @ApiProperty({ example: 'We are looking for a skilled developer...', description: 'Detailed description' })
  @Prop({ required: true })
  description: string;

  @ApiProperty({ example: ['javascript', 'nodejs', 'react'], description: 'Tags for categorization' })
  @Prop([String])
  tags: string[];

  @ApiProperty({ example: ['javascript', 'nodejs', 'react'], description: 'Tags for categorization' })
  @Prop([String])
  exigences: string[];


  @ApiProperty({
    example: {
      address: '123 Main St',
      city: 'Paris',
      country: 'France',
      coordinates: { lat: 48.8566, lng: 2.3522 }
    },
    description: 'Location details'
  })
  @Prop({
    type: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      country: { type: String, required: true },
      coordinates: {
        lat: { type: Number, required: false },
        lng: { type: Number, required: false }
      }
    },
    required: true
  })
  location: {
    address: string;
    city: string;
    country: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };

  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'User ID who created the offer' })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @ApiProperty({ example: true, description: 'Whether the offer is active' })
  @Prop({ default: true })
  isActive: boolean;

  @ApiProperty({ example: 150, description: 'Number of views' })
  @Prop({ default: 0 })
  viewCount: number;

  @ApiProperty({ example: 'IT', description: 'Category of the offer' })
  @Prop()
  category: string;

  @ApiProperty({ example: '50000-70000 EUR', description: 'Salary range' })
  @Prop()
  salary?: string;

  @ApiProperty({ example: 'Tech Corp', description: 'Company name' })
  @Prop({ required: true })
  company: string;

  @ApiProperty({ example: '2024-12-31', description: 'Expiration date' })
  @Prop({ default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) })
  expiresAt: Date;

  @ApiProperty({ enum: JobType, example: JobType.JOB, description: 'Type of job' })
  @Prop({ type: String, enum: JobType, default: JobType.JOB })
  jobType: JobType;

  @ApiProperty({ enum: Shift, example: Shift.JOUR, description: 'Work shift' })
  @Prop({ type: String, enum: Shift, default: Shift.JOUR })
  shift: Shift;

  @ApiProperty({ example: 5, description: 'Days since creation' })
  @Prop({ default: 0 })
  days: number;

  @ApiProperty({ example: 25, description: 'Number of likes' })
  @Prop({ default: 0 })
  likeCount: number;

  // Track users who liked this offer
  @Prop([{ type: Types.ObjectId, ref: 'User' }])
  likedBy: Types.ObjectId[];


  @ApiProperty({ description: 'Accepted users IDs', example: [] })
  @Prop([{ type: Types.ObjectId, ref: 'User' }])
  acceptedUsers: Types.ObjectId[];

  @ApiProperty({ description: 'Blocked users IDs', example: [] })
  @Prop([{ type: Types.ObjectId, ref: 'User' }])
  blockedUsers: Types.ObjectId[];
}

export const OffreSchema = SchemaFactory.createForClass(Offre);