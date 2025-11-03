import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '../User/user.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private UserService: UserService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'changeme',
    });
  }

  async validate(payload: any) {
    console.log('🔐 JWT Strategy - payload:', payload);
    const user = await this.UserService.findOne(payload.sub);
    console.log('👤 JWT Strategy - found user:', user);
    if (!user) return null;
    console.log('✅ JWT Strategy - returning user');
    return user;
  }
}
