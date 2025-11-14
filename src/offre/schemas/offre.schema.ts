// schemas/offre.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type OffreDocument = HydratedDocument<Offre>;

@Schema({ timestamps: true, versionKey: false })
export class Offre {
  @ApiProperty({ example: 'Senior Developer', description: 'Title of the offer' })
  @Prop({ required: true })
  title: string;

  @ApiProperty({ example: 'https://example.com/image.jpg', description: 'Offer image URL' })
  @Prop({ required: true })
  image: string;

  @ApiProperty({ example: 'We are looking for a skilled developer...', description: 'Detailed description' })
  @Prop({ required: true })
  description: string;

  @ApiProperty({ example: ['javascript', 'nodejs', 'react'], description: 'Tags for categorization' })
  @Prop([String])
  tags: string[];

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
      address: String,
      city: String,
      country: String,
      coordinates: {
        lat: Number,
        lng: Number
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
  @Prop()
  company?: string;

  @ApiProperty({ example: '2024-12-31', description: 'Expiration date' })
  @Prop({ default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }) // 30 days from now
  expiresAt: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export const OffreSchema = SchemaFactory.createForClass(Offre);