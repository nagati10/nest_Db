import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        // First, check if MONGO_URI is directly provided
        const directMongoUri = configService.get<string>('MONGO_URI');
        if (directMongoUri) {
          console.log('✅ Using direct MONGO_URI from .env');
          return { uri: directMongoUri };
        }

        // If not, build MONGO_URI from individual components
        const username = configService.get<string>('DB_USERNAME');
        const password = configService.get<string>('DB_PASSWORD');
        const cluster = configService.get<string>('DB_CLUSTER');
        const dbName = configService.get<string>('DB_NAME', 'Db_App_Mobile');

        // If all cloud components are provided, build MongoDB Atlas URI
        if (username && password && cluster) {
          const mongoUri = `mongodb+srv://${username}:${password}@${cluster}/${dbName}?retryWrites=true&w=majority`;
          console.log(`☁️  Using MongoDB Atlas:${username}`);
          return { uri: mongoUri };
        }

        // Fallback to local MongoDB
        const localUri = `mongodb://localhost:27017/${dbName}`;
        console.log(`🔄 Using local MongoDB: ${localUri}`);
        return { uri: localUri };
      },
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}