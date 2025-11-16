import { Controller, Get, Post, Body, Patch, Param, Delete, HttpException, HttpStatus, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import path from 'path';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('admins')
@Controller('admin')
@Roles('admin')
export class AdminController {
  constructor(private readonly userService: UserService) {}

  @Post('register')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Register new user', description: 'Create a new user account with optional profile image' })
  @ApiBody({
    description: 'User registration form with optional profile image',
    type: CreateUserDto
  })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 500, description: 'Problem niv serveur' })
  @UseInterceptors(FileInterceptor('image', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
      }
    })
  }))
  async create(
    @Body() createUserDto: CreateUserDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    try {
      return await this.userService.create(createUserDto, image);
    } catch (error) {
      if (error.name === 'ValidationError' || error.name === 'CastError') {
        throw new HttpException('Invalid input', HttpStatus.BAD_REQUEST);
      }
      throw new HttpException('Problem au niveau serveur', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('email-exists/:email')
  @ApiOperation({ summary: 'Check if email exists in system' })
  @ApiResponse({ status: 200, description: 'Email existence check completed', schema: {
  properties: {
    exists: { type: 'boolean', example: true }
  }
  }})
  async emailExists(@Param('email') email: string) {
  const exists = await this.userService.checkEmailExists(email);
  return { exists };
  }
  
  @Get('Get_All_Users')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get All users profile' })
  @ApiResponse({ status: 200, description: 'Get All users profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin Only' })
  @UseGuards(JwtAuthGuard,RolesGuard)
  async findAll() {
    return this.userService.findAll();
  }

  @Delete('Delete_All_Users')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete All users profile' })
  @ApiResponse({ status: 200, description: 'delete All user profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin Only' })
  @UseGuards(JwtAuthGuard,RolesGuard)
  Empty() {
    return this.userService.empty();
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update Any users profile' })
  @ApiResponse({ status: 200, description: 'update any user profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard,RolesGuard)
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete Any users profile' })
  @ApiResponse({ status: 200, description: 'delete any user profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin Only' })
  @UseGuards(JwtAuthGuard,RolesGuard)
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }

  @Get('user-by-email/:email')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Find user by email' })
  @ApiResponse({ status: 200, description: 'User found successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin Only' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  async findByEmail(@Param('email') email: string) {
  const user = await this.userService.findByEmail(email);

  if (!user) {
    throw new HttpException('User not found', HttpStatus.NOT_FOUND);
  }

  return user;
  }

  @Patch(':id/archive/toggle')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Toggle archive state for any user' })
  @ApiResponse({ status: 200, description: 'Archive state toggled successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin Only' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  async switchArchiveState(@Param('id') id: string) {
    return this.userService.switchArchiveState(id);
  }

  @Patch(':id/trust/level-up/:xp')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Increase trust XP for any user' })
  @ApiResponse({ status: 200, description: 'Trust XP increased successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin Only' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  async levelUp(@Param('id') id: string, @Param('xp') xp: number) {
    return this.userService.levelUp(id, xp);
  }

  @Patch(':id/trust/level-down/:xp')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Decrease trust XP for any user' })
  @ApiResponse({ status: 200, description: 'Trust XP decreased successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin Only' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  async levelDown(@Param('id') id: string, @Param('xp') xp: number) {
    return this.userService.levelDown(id, xp);
  }

  @Patch(':id/organization/toggle')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Toggle organization status for any user' })
  @ApiResponse({ status: 200, description: 'Organization status toggled successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin Only' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  async toggleOrganization(@Param('id') id: string) {
    return this.userService.toggleOrganization(id);
  }
}