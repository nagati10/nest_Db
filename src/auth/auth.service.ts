import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../User/user.service';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { log } from 'console';
import { Role } from 'src/User/enums/role.enum';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private jwtService: JwtService,
    private userService: UserService,
  ) {
    // Initialize Google OAuth2 client
    this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

  async validateUser(email: string, password: string) {
    const user = await this.userService.findByEmail(email);
    if (!user) return null;
    const matched = await bcrypt.compare(password, user.password || '');
    if (matched) {
      return user;
    }
    return null;
  }

  async login(user: any) {
    const payload = { sub: user._id, email: user.email };
    log('AuthService Login - payload:', payload);
    return { 
      status: "success",
      message: "Login successful",
      access_token: this.jwtService.sign(payload),
      user: {
        _id: user._id,
        nom: user.nom,
        email: user.email,
        role: user.role,
        contact: user.contact,
        image: user.image
      }
    };
  }

async googleLogin(idToken: string) {
  try {
    //console.log('🔐 Starting Google login with token:', idToken.substring(0, 20) + '...');

    // Verify Google token
    const ticket = await this.googleClient.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    //console.log('✅ Google token verified');

    const payload = ticket.getPayload();
    //console.log('📧 Google payload:', payload);

    if (!payload) {
      throw new UnauthorizedException('Invalid Google token: no payload');
    }

    const email = payload.email;
    const name = payload.name;
    const picture = payload.picture;

    if (!email) {
      throw new UnauthorizedException('Invalid Google token: no email provided');
    }

    //console.log('👤 Looking for user with email:', email);
    
    // Find or create user in MongoDB
    let user = await this.userService.findByEmail(email);
    //console.log('🔍 User search result:', user);
    
    if (!user) {
      //console.log('🆕 Creating new user for email:', email);
      user = await this.userService.create({
        nom: name || 'Google User',
        email: email,
        password: '',
        contact: 'Not provided',
        role: Role.USER,
        image: picture || '',
      });
      //console.log('✅ New user created:', user);
    }

    //console.log('🎫 Generating JWT token for user:', user.email);
    // Generate JWT token using existing login method
    const result = this.login(user);
    //console.log('✅ Google login successful');
    return result;

  } catch (error) {
    console.error('❌ Google login error:', error);
    console.error('❌ Error stack:', error.stack);
    return {
      status: "error",
      message: "Invalid Google token: " + error.message
    };
  }
}
}