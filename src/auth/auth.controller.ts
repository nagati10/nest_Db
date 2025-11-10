import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { ResetPasswordDto } from 'src/User/dto/reset-password-dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'User login', description: 'Login with email and password to get JWT token' })
  @ApiResponse({ status: 200, description: 'Successfully logged in, returns JWT token' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    if (!user) return { status: 'error', message: 'Invalid credentials' };
    return this.authService.login(user);
  }

  @Post('google')
  @ApiOperation({ summary: 'Google login', description: 'Login with Google ID token' })
  @ApiResponse({ status: 200, description: 'Successfully logged in with Google, returns JWT token' })
  @ApiResponse({ status: 401, description: 'Invalid Google token' })
  async googleLogin(@Body() dto: GoogleLoginDto) {
    return this.authService.googleLogin(dto.id_token);
  }

  @Get('config-test')
  @ApiOperation({ summary: 'Test Google configuration' })
  testGoogleConfig() {
  return {
    hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
    googleClientId: process.env.GOOGLE_CLIENT_ID || 'Missing',
    hasJwtSecret: !!process.env.JWT_SECRET,
    message: process.env.GOOGLE_CLIENT_ID ? 'Ready for Google auth' : 'Need GOOGLE_CLIENT_ID in .env'
  };
}

}