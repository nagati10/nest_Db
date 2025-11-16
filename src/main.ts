import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { AppModule } from './app.module';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Enable CORS for your Android app
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3001'], // Add your Android app URLs
    credentials: true,
  });

  // Serve static files for all uploads (this includes chat)
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // Remove this line - it's redundant since the above line already serves all uploads
  // app.use('/uploads/chat', express.static(join(__dirname, '..', 'uploads', 'chat')));

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

  // Use Render's port or default to 3005
  const port = process.env.PORT || 3005;
  await app.listen(port);
  console.log(`🚀 Application running on: http://localhost:${port}`);
  console.log(`📚 Swagger docs available on: http://localhost:${port}/api`);
}

bootstrap();