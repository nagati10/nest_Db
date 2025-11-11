import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller()
@ApiTags('App') // Main tag for the controller
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Get hello message', description: 'Returns a welcome message' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiTags('Health') // Specific tag for health endpoint
  @ApiOperation({ summary: 'Health check', description: 'Check if the API is running and get system status' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  healthCheck(): object {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development',
    };
  }
}