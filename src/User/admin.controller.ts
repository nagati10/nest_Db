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
  @ApiOperation({ summary: 'Register new user', description: 'Create a new user account with optional profile image' })
  @ApiConsumes('multipart/form-data')
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

}
