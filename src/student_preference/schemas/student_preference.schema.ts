import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { StudyLevel } from '../enums/study-level.enum';
import { StudyDomain } from '../enums/study-domain.enum';
import { LookingFor } from '../enums/looking-for.enum';
import { MainMotivation } from '../enums/motivation.enum';
import { SoftSkills } from '../enums/soft-skills.enum';
import { LanguageLevel } from '../enums/language-level.enum';
import { Hobbies } from '../enums/hobbies.enum';

export type StudentPreferenceDocument = HydratedDocument<StudentPreference>;

@Schema({ timestamps: true, versionKey: false })
export class StudentPreference {
  @ApiProperty({ description: 'L\'utilisateur concerné' })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  // Academic Information (Step 1)
  @ApiProperty({ 
    description: 'Niveau d\'étude', 
    enum: StudyLevel, 
    example: StudyLevel.LICENCE_1 
  })
  @Prop({ type: String, enum: StudyLevel, required: true })
  study_level: StudyLevel;

  @ApiProperty({ 
    description: 'Domaine d\'étude', 
    enum: StudyDomain, 
    example: StudyDomain.INFORMATIQUE 
  })
  @Prop({ type: String, enum: StudyDomain, required: true })
  study_domain: StudyDomain;

  // Search Preferences (Step 2)
  @ApiProperty({ 
    description: 'Ce que l\'étudiant cherche', 
    enum: LookingFor, 
    example: LookingFor.JOB 
  })
  @Prop({ type: String, enum: LookingFor, required: true })
  looking_for: LookingFor;

  @ApiProperty({ 
    description: 'Motivation principale', 
    enum: MainMotivation, 
    example: MainMotivation.EXPERIENCE 
  })
  @Prop({ type: String, enum: MainMotivation, required: true })
  main_motivation: MainMotivation;

  // Skills (Step 3) - Now supports multiple selections
  @ApiProperty({ 
    description: 'Compétences douces sélectionnées', 
    type: [String],
    enum: SoftSkills,
    example: [SoftSkills.COMMUNICATION, SoftSkills.ORGANISATION] 
  })
  @Prop({ type: [String], enum: SoftSkills, required: true })
  soft_skills: SoftSkills[];

  // Language Levels (Step 4)
  @ApiProperty({ 
    description: 'Niveau en arabe', 
    enum: LanguageLevel, 
    example: LanguageLevel.COURANT 
  })
  @Prop({ type: String, enum: LanguageLevel, required: true })
  langue_arabe: LanguageLevel;

  @ApiProperty({ 
    description: 'Niveau en français', 
    enum: LanguageLevel, 
    example: LanguageLevel.INTERMEDIAIRE 
  })
  @Prop({ type: String, enum: LanguageLevel, required: true })
  langue_francais: LanguageLevel; // Changed from langue_fran

  @ApiProperty({ 
    description: 'Niveau en anglais', 
    enum: LanguageLevel, 
    example: LanguageLevel.DEBUTANT 
  })
  @Prop({ type: String, enum: LanguageLevel, required: true })
  langue_anglais: LanguageLevel; // Changed from langue_angler

  // Hobbies (Step 5)
  @ApiProperty({ 
    description: 'Centres d\'intérêt principaux', 
    type: [String],
    enum: Hobbies,
    example: [Hobbies.SPORT, Hobbies.MUSIQUE] 
  })
  @Prop({ type: [String], enum: Hobbies, required: true })
  hobbies: Hobbies[];

  @ApiProperty({ 
    description: 'Avoir un deuxième hobby', 
    example: true 
  })
  @Prop({ type: Boolean, required: true })
  has_second_hobby: boolean; // Changed from hobbie_2

  // Additional fields for step tracking
  @ApiProperty({ 
    description: 'Étape actuelle du formulaire', 
    example: 5 
  })
  @Prop({ type: Number, default: 1, min: 1, max: 5 })
  current_step: number;

  @ApiProperty({ 
    description: 'Formulaire complété', 
    example: false 
  })
  @Prop({ type: Boolean, default: false })
  is_completed: boolean;
}

export const StudentPreferenceSchema = SchemaFactory.createForClass(StudentPreference);