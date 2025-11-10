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
        // For Render - use environment variables directly
        const mongoUri = configService.get<string>('MONGODB_URI');
        if (mongoUri) {
          console.log('✅ Using MONGODB_URI from environment');
          return { uri: mongoUri };
        }

        // Fallback to individual components for local development
        const username = configService.get<string>('DB_USERNAME');
        const password = configService.get<string>('DB_PASSWORD');
        const cluster = configService.get<string>('DB_CLUSTER');
        const dbName = configService.get<string>('DB_NAME', 'Db_App_Mobile');

        if (username && password && cluster) {
          const builtUri = `mongodb+srv://${username}:${password}@${cluster}/${dbName}?retryWrites=true&w=majority`;
          console.log(`☁️ Using MongoDB Atlas`);
          return { uri: builtUri };
        }

        // Final fallback to local MongoDB
        const localUri = `mongodb://localhost:27017/${dbName}`;
        console.log(`🔄 Using local MongoDB: ${localUri}`);
        return { uri: localUri };
      },
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}