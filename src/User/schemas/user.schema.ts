import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../enums/role.enum';

export type UserDocument = HydratedDocument<User>;

@Schema({
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform: function (doc, ret) {
      return ret;
    },
  },
})
export class User {
  @ApiProperty({ description: 'User ID', example: '507f1f77bcf86cd799439011' })
  _id: Types.ObjectId;

  @ApiProperty({ description: 'User name', example: 'Najd' })
  @Prop({
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [50, 'Name cannot exceed 50 characters'],
  })
  nom: string;

  @ApiProperty({ description: 'User email', example: 'user@example.com' })
  @Prop({
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
  })
  email: string;

  @ApiProperty({ description: 'User password (hashed)', example: 'hashedPassword123' })
  @Prop({
    required: [true, 'Password is required'],
    select: false,
    minlength: [6, 'Password must be at least 6 characters long'],
  })
  password: string;

  @ApiProperty({ description: 'User role', enum: Role, example: Role.USER })
  @Prop({
    type: String,
    enum: Object.values(Role),
    default: Role.USER,
    validate: {
      validator: function (value: Role) {
        return Object.values(Role).includes(value);
      },
      message: 'Invalid role provided',
    },
  })
  role: Role;

  @ApiProperty({ description: 'User contact information', example: '+216 21 000 000' })
  @Prop({
    required: [true, 'Contact is required'],
    trim: true,
  })
  contact: string;

  @ApiProperty({
    description: 'Profile image path',
    example: 'uploads/profile-123456789.jpg',
    required: false,
  })
  @Prop({
    required: false,
    default: null,
  })
  image?: string;

  @ApiProperty({ description: 'Exam mode enabled or not', example: false })
  @Prop({
    type: Boolean,
    default: false,
  })
  modeExamens: boolean;

  @ApiProperty({ description: 'Archived status', example: false })
  @Prop({
    type: Boolean,
    default: false,
    index: true,
  })
  is_archive: boolean;

  @ApiProperty({ description: 'Trust experience points', example: 0 })
  @Prop({
    type: Number,
    default: 0,
    min: [0, 'Trust XP cannot be negative'],
    validate: {
      validator: Number.isInteger,
      message: 'Trust XP must be an integer',
    },
  })
  TrustXP: number;

  @ApiProperty({ description: 'Organization status', example: false })
  @Prop({
    type: Boolean,
    default: false,
    index: true,
  })
  is_Organization: boolean;

  @ApiProperty({
    description: 'Array of liked offer IDs',
    example: ['507f1f77bcf86cd799439011'],
  })
  @Prop([
    {
      type: Types.ObjectId,
      ref: 'Offre',
      index: true,
    },
  ])
  likedOffres: Types.ObjectId[];

  @ApiProperty({ description: 'Array of chat IDs', example: ['507f1f77bcf86cd799439011'] })
  @Prop([
    {
      type: Types.ObjectId,
      ref: 'Chat',
      index: true,
    },
  ])
  chats: Types.ObjectId[];

  @ApiProperty({
    description: 'Array of blocked user IDs',
    example: ['507f1f77bcf86cd799439011'],
  })
  @Prop([
    {
      type: Types.ObjectId,
      ref: 'User',
      index: true,
    },
  ])
  blockedUsers: Types.ObjectId[];

  @ApiProperty({ description: 'Is user online', example: false })
  @Prop({
    type: Boolean,
    default: false,
    index: true,
  })
  isOnline: boolean;

  @ApiProperty({ description: 'Last seen timestamp', example: '2023-10-05T14:48:00.000Z' })
  @Prop({
    type: Date,
    default: Date.now,
    index: true,
  })
  lastSeen: Date;

  @ApiProperty({
    description: 'Current status',
    enum: ['active', 'inactive', 'busy'],
    example: 'active',
  })
  @Prop({
    type: String,
    enum: ['active', 'inactive', 'busy'],
    default: 'active',
    index: true,
  })
  Currentstatus: string;

  @ApiProperty({ description: 'Creation timestamp', example: '2023-10-05T14:48:00.000Z' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp', example: '2023-10-05T14:48:00.000Z' })
  updatedAt: Date;

  // ---------- Profil CV depuis IA ----------
  @ApiProperty({
    description: 'Experience extracted from CV',
    example: ['Chargée de projet chez X', 'Stage dev chez Y'],
    required: false,
  })
  @Prop({ type: [String], default: [] })
  cvExperience: string[];

  @ApiProperty({
    description: 'Education extracted from CV',
    example: ['Licence Informatique - Université Z'],
    required: false,
  })
  @Prop({ type: [String], default: [] })
  cvEducation: string[];

  @ApiProperty({
    description: 'Skills extracted from CV',
    example: ['Java', 'Spring', 'React'],
    required: false,
  })
  @Prop({ type: [String], default: [] })
  cvSkills: string[];

  // ---------- Virtual: trust level ----------
  @ApiProperty({
    description: 'Trust level information',
    example: { level: 2, text: 'Intermediate' },
  })
  public get trustLevel(): { level: number; text: string } {
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
      if (this.TrustXP >= trustLevels[i].threshold) {
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

  // ---------- Virtual: profile completion ----------
  @ApiProperty({
    description: 'Profile completion percentage',
    example: 75,
  })
  public get profileCompletion(): number {
    const fields = [this.nom, this.email, this.contact, this.image];

    const completedFields = fields.filter(
      (field) => field !== null && field !== undefined && field !== '',
    ).length;

    return Math.round((completedFields / fields.length) * 100);
  }
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ is_archive: 1, is_Organization: 1 });
UserSchema.index({ TrustXP: -1 });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ likedOffres: 1 });

// Middleware
UserSchema.pre('save', function (next) {
  if (this.isModified('isOnline') && this.isOnline) {
    this.lastSeen = new Date();
  }
  next();
});

// Statics
UserSchema.statics.findActiveUsers = function () {
  return this.find({
    is_archive: false,
    isOnline: true,
  });
};

UserSchema.statics.findByTrustRange = function (minXP: number, maxXP: number) {
  return this.find({
    TrustXP: { $gte: minXP, $lte: maxXP },
    is_archive: false,
  });
};

// Methods
UserSchema.methods.canBeContacted = function () {
  return this.isOnline && this.Currentstatus === 'active' && !this.is_archive;
};

UserSchema.methods.toggleArchive = function () {
  this.is_archive = !this.is_archive;
  return this.save();
};

UserSchema.methods.addLikedOffre = function (offreId: Types.ObjectId) {
  if (!this.likedOffres.includes(offreId)) {
    this.likedOffres.push(offreId);
  }
  return this.save();
};

UserSchema.methods.removeLikedOffre = function (offreId: Types.ObjectId) {
  this.likedOffres = this.likedOffres.filter(
    (id: Types.ObjectId) => id.toString() !== offreId.toString(),
  );
  return this.save();
};

UserSchema.methods.hasLikedOffre = function (offreId: Types.ObjectId) {
  return this.likedOffres.some(
    (id: Types.ObjectId) => id.toString() === offreId.toString(),
  );
};
