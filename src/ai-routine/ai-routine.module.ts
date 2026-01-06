import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AIRoutineController } from './ai-routine.controller';
import { AIRoutineService } from './ai-routine.service';
import { AIRoutineEnhancedService } from './ai-routine-enhanced.service';
import { Offre, OffreSchema } from '../offre/schemas/offre.schema';
import * as redisStore from 'cache-manager-redis-store';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Offre.name, schema: OffreSchema },
    ]),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisHost = configService.get<string>('REDIS_HOST', 'localhost');
        const redisPort = configService.get<number>('REDIS_PORT', 6379);
        
        return {
          store: redisStore,
          host: redisHost,
          port: redisPort,
          ttl: 3600, // 1 heure
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AIRoutineController],
  providers: [AIRoutineService, AIRoutineEnhancedService],
  exports: [AIRoutineService, AIRoutineEnhancedService],
})
export class AIRoutineModule {}

