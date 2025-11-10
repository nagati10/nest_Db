import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleLoginDto {
  @ApiProperty({
    description: 'Google ID token from mobile app',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjFmZmU1Mz' // You can put a fake token for testing
  })
  @IsNotEmpty()
  @IsString()
  id_token: string;
}