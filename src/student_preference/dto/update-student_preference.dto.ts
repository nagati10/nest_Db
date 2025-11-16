import { IsString, IsNotEmpty, IsEnum, IsOptional, IsArray, IsBoolean, IsNumber, Min, Max, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { StudyLevel } from '../enums/study-level.enum';
import { StudyDomain } from '../enums/study-domain.enum';
import { LookingFor } from '../enums/looking-for.enum';
import { MainMotivation } from '../enums/motivation.enum';
import { SoftSkills } from '../enums/soft-skills.enum';
import { LanguageLevel } from '../enums/language-level.enum';
import { Hobbies } from '../enums/hobbies.enum';

export class UpdateStudentPreferenceDto {
  // Step 1: Academic Information
  @ApiProperty({ 
    description: 'Niveau d\'étude', 
    enum: StudyLevel, 
    example: StudyLevel.LICENCE_1 
  })
  @IsNotEmpty()
  @IsEnum(StudyLevel)
  study_level: StudyLevel;

  @ApiProperty({ 
    description: 'Domaine d\'étude', 
    enum: StudyDomain, 
    example: StudyDomain.INFORMATIQUE 
  })
  @IsNotEmpty()
  @IsEnum(StudyDomain)
  study_domain: StudyDomain;

  // Step 2: Search Preferences
  @ApiProperty({ 
    description: 'Ce que l\'étudiant cherche', 
    enum: LookingFor, 
    example: LookingFor.JOB 
  })
  @IsNotEmpty()
  @IsEnum(LookingFor)
  looking_for: LookingFor;

  @ApiProperty({ 
    description: 'Motivation principale', 
    enum: MainMotivation, 
    example: MainMotivation.EXPERIENCE 
  })
  @IsNotEmpty()
  @IsEnum(MainMotivation)
  main_motivation: MainMotivation;

  // Step 3: Skills (select up to 2)
  @ApiProperty({ 
    description: 'Compétences douces (sélectionner 2 maximum)', 
    type: [String],
    enum: SoftSkills,
    example: [SoftSkills.COMMUNICATION, SoftSkills.ORGANISATION] 
  })
  @IsNotEmpty()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @IsEnum(SoftSkills, { each: true })
  soft_skills: SoftSkills[];

  // Step 4: Language Levels
  @ApiProperty({ 
    description: 'Niveau en arabe', 
    enum: LanguageLevel, 
    example: LanguageLevel.COURANT 
  })
  @IsNotEmpty()
  @IsEnum(LanguageLevel)
  langue_arabe: LanguageLevel;

  @ApiProperty({ 
    description: 'Niveau en français', 
    enum: LanguageLevel, 
    example: LanguageLevel.INTERMEDIAIRE 
  })
  @IsNotEmpty()
  @IsEnum(LanguageLevel)
  langue_francais: LanguageLevel;

  @ApiProperty({ 
    description: 'Niveau en anglais', 
    enum: LanguageLevel, 
    example: LanguageLevel.DEBUTANT 
  })
  @IsNotEmpty()
  @IsEnum(LanguageLevel)
  langue_anglais: LanguageLevel;

  // Step 5: Hobbies
  @ApiProperty({ 
    description: 'Centres d\'intérêt principaux', 
    type: [String],
    enum: Hobbies,
    example: [Hobbies.SPORT, Hobbies.MUSIQUE] 
  })
  @IsNotEmpty()
  @IsArray()
  @IsEnum(Hobbies, { each: true })
  hobbies: Hobbies[];

  @ApiProperty({ 
    description: 'Avoir un deuxième hobby', 
    example: true 
  })
  @IsNotEmpty()
  @IsBoolean()
  has_second_hobby: boolean;

  // Step tracking (optional for creation)
  @ApiProperty({ 
    description: 'Étape actuelle du formulaire', 
    example: 5,
    required: false 
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  current_step?: number;

  @ApiProperty({ 
    description: 'Formulaire complété', 
    example: false,
    required: false 
  })
  @IsOptional()
  @IsBoolean()
  is_completed?: boolean;
}