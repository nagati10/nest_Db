import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../User/user.service';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { log } from 'console';

@Injectable()
export class AuthService {
  constructor( private jwtService: JwtService,private userService: UserService) {}

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
    return { access_token: this.jwtService.sign(payload) };
  }
}
