import { Module } from '@nestjs/common';
import { StudentPreferenceService } from './student_preference.service';
import { StudentPreferenceController } from './student_preference.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { StudentPreference, StudentPreferenceSchema } from './schemas/student_preference.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { 
        name: StudentPreference.name, 
        schema: StudentPreferenceSchema 
      }
    ])
  ],
  controllers: [StudentPreferenceController],
  providers: [StudentPreferenceService],
  exports: [StudentPreferenceService]
})
export class StudentPreferenceModule {}