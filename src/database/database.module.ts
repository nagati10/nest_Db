import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'production' ? '.env.production' : '.env',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        // Priority 1: Direct MONGODB_URI (for Render)
        const mongoUri = configService.get<string>('MONGODB_URI');
        if (mongoUri) {
          console.log('✅ Using MONGODB_URI from environment');
          return { uri: mongoUri };
        }

        // Priority 2: Individual components (for local development)
        const username = configService.get<string>('DB_USERNAME');
        const password = configService.get<string>('DB_PASSWORD');
        const cluster = configService.get<string>('DB_CLUSTER');
        const dbName = configService.get<string>('DB_NAME', 'Talleb_5edma'); // Fixed default DB name

        if (username && password && cluster) {
          const builtUri = `mongodb+srv://${username}:${password}@${cluster}/${dbName}?retryWrites=true&w=majority`;
          console.log(`☁️ Using MongoDB Atlas with database: ${dbName}`);
          return { uri: builtUri };
        }

        // Fallback: Local MongoDB
        const localUri = `mongodb://localhost:27017/${dbName}`;
        console.log(`🔄 Using local MongoDB: ${localUri}`);
        return { uri: localUri };
      },
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}