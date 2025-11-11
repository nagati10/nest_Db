import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { AppModule } from './app.module';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as https from 'https';
import * as http from 'http';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Enable CORS for your Android app
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3001'], // Add your Android app URLs
    credentials: true,
  });

  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, 
    forbidNonWhitelisted: true, 
    transform: true, 
    exceptionFactory: (errors) => {
      const formattedErrors = errors.map(error => {
        const constraints = error.constraints || {};
        const constraintKeys = Object.keys(constraints);
        const firstConstraint = constraintKeys.length > 0 ? constraints[constraintKeys[0]] : 'Validation error';
        return {
          field: error.property,
          message: firstConstraint
        };
      });
      throw new BadRequestException({
        statusCode: 400,
        message: 'Invalid input',
        errors: formattedErrors
      });
    }
  }));

  const config = new DocumentBuilder()
    .setTitle('Talleb 5edma Bd')
    .setDescription('API for managing The data base')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Use Render's port or default to 3005 - Convert to number
  const port = parseInt(process.env.PORT || '3005', 10);
  await app.listen(port);
  
  // Start health check pinger for Render free tier
  startHealthCheckPinger(port);
  
  console.log(`🚀 Application running on: http://localhost:${port}`);
  console.log(`📚 Swagger docs available on: http://localhost:${port}/api`);
  console.log(`❤️ Health check endpoint: http://localhost:${port}/health`);
}

function startHealthCheckPinger(port: number) {
  const healthCheckUrl = `http://localhost:${port}/health`;
  
  const pingServer = () => {
    const protocol = healthCheckUrl.startsWith('https') ? https : http;
    
    const req = protocol.get(healthCheckUrl, (res) => {
      if (res.statusCode === 200) {
        console.log(`✅ Health check successful at ${new Date().toISOString()}`);
      } else {
        console.log(`⚠️ Health check returned status: ${res.statusCode}`);
      }
    });

    req.on('error', (err) => {
      console.error(`❌ Health check failed: ${err.message}`);
    });

    req.setTimeout(10000, () => {
      console.log('⏰ Health check timeout');
      req.destroy();
    });
  };

  // Ping immediately on startup
  pingServer();
  
  // Then ping every 45 seconds
  const intervalMs = 45 * 1000; // 45 seconds
  setInterval(pingServer, intervalMs);
  
  console.log(`🔄 Health check pinger started (every ${intervalMs/1000} seconds)`);
}

bootstrap();