import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { StudentPreferenceService } from './student_preference.service';
import { CreateStudentPreferenceDto } from './dto/create-student_preference.dto';
import { UpdateStudentPreferenceDto } from './dto/update-student_preference.dto';
import { UpdateStepDto } from './dto/update-step.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('student-preferences')
@Controller('student-preferences')
@ApiBearerAuth()
export class StudentPreferenceController {
  constructor(private readonly studentPreferenceService: StudentPreferenceService) {}

  @Post()
  @ApiOperation({ summary: 'Créer ou compléter les préférences étudiant' })
  @ApiResponse({ status: 201, description: 'Préférences créées avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() createStudentPreferenceDto: CreateStudentPreferenceDto,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.studentPreferenceService.completeForm(userId, createStudentPreferenceDto);
  }

  // New endpoint for step-by-step form updates
  @Patch('step/:step')
  @ApiOperation({ summary: 'Mettre à jour une étape spécifique du formulaire' })
  @ApiResponse({ status: 200, description: 'Étape mise à jour avec succès' })
  @ApiResponse({ status: 400, description: 'Données d\'étape invalides' })
  @UseGuards(JwtAuthGuard)
  async updateStep(
    @Param('step') step: string, // Changed to string since params are always strings
    @Body() updateStepDto: UpdateStepDto,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user._id || user.id;
    const stepNumber = parseInt(step);
    return this.studentPreferenceService.updateStep(userId, stepNumber, updateStepDto.data);
  }

  // New endpoint to get form progress
  @Get('progress')
  @ApiOperation({ summary: 'Obtenir la progression du formulaire' })
  @ApiResponse({ status: 200, description: 'Progression du formulaire' })
  @UseGuards(JwtAuthGuard)
  async getProgress(@CurrentUser() user: any) {
    const userId = user.userId || user._id || user.id;
    return this.studentPreferenceService.getFormProgress(userId);
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer toutes les préférences étudiant (Admin seulement)' })
  @ApiResponse({ status: 200, description: 'Liste de toutes les préférences' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async findAll() {
    return this.studentPreferenceService.findAll();
  }

  @Get('my-preferences')
  @ApiOperation({ summary: 'Récupérer les préférences de l\'utilisateur connecté' })
  @ApiResponse({ status: 200, description: 'Préférences de l\'utilisateur' })
  @ApiResponse({ status: 404, description: 'Préférences non trouvées' })
  @UseGuards(JwtAuthGuard)
  async findByUser(@CurrentUser() user: any) {
    const userId = user.userId || user._id || user.id;
    return this.studentPreferenceService.findByUser(userId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Rechercher des étudiants par critères' })
  @ApiQuery({ name: 'study_level', required: false, description: 'Niveau d\'étude' })
  @ApiQuery({ name: 'study_domain', required: false, description: 'Domaine d\'étude' })
  @ApiQuery({ name: 'looking_for', required: false, description: 'Ce qu\'ils cherchent' })
  @ApiQuery({ name: 'main_motivation', required: false, description: 'Motivation principale' })
  @ApiQuery({ name: 'soft_skills', required: false, description: 'Compétences douces', type: [String] })
  @ApiResponse({ status: 200, description: 'Liste des étudiants correspondant aux critères' })
  @UseGuards(JwtAuthGuard)
  async findByCriteria(
    @Query('study_level') study_level?: string,
    @Query('study_domain') study_domain?: string,
    @Query('looking_for') looking_for?: string,
    @Query('main_motivation') main_motivation?: string,
    @Query('soft_skills') soft_skills?: string | string[],
  ) {
    const criteria: any = {};
    if (study_level) criteria.study_level = study_level;
    if (study_domain) criteria.study_domain = study_domain;
    if (looking_for) criteria.looking_for = looking_for;
    if (main_motivation) criteria.main_motivation = main_motivation;
    
    // Handle array of soft skills
    if (soft_skills) {
      if (Array.isArray(soft_skills)) {
        criteria.soft_skills = soft_skills;
      } else {
        criteria.soft_skills = [soft_skills];
      }
    }

    return this.studentPreferenceService.findByCriteria(criteria);
  }

  @Get('stats/study-level')
  @ApiOperation({ summary: 'Obtenir les statistiques par niveau d\'étude' })
  @ApiResponse({ status: 200, description: 'Statistiques par niveau d\'étude' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getStudyLevelStats() {
    return this.studentPreferenceService.getStatsByStudyLevel();
  }

  @Get('stats/study-domain')
  @ApiOperation({ summary: 'Obtenir les statistiques par domaine d\'étude' })
  @ApiResponse({ status: 200, description: 'Statistiques par domaine d\'étude' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getStudyDomainStats() {
    return this.studentPreferenceService.getStatsByStudyDomain();
  }

  @Get('stats/looking-for')
  @ApiOperation({ summary: 'Obtenir les statistiques par type de recherche' })
  @ApiResponse({ status: 200, description: 'Statistiques par type de recherche' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getLookingForStats() {
    return this.studentPreferenceService.getStatsByLookingFor();
  }

  @Get('stats/completion')
  @ApiOperation({ summary: 'Obtenir les statistiques de complétion du formulaire' })
  @ApiResponse({ status: 200, description: 'Statistiques de complétion' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getCompletionStats() {
    const total = await this.studentPreferenceService.count();
    const completed = await this.studentPreferenceService.countCompleted();
    
    return {
      total_users: total,
      completed_forms: completed,
      completion_rate: total > 0 ? (completed / total * 100).toFixed(2) + '%' : '0%'
    };
  }

  @Get('stats/soft-skills')
  @ApiOperation({ summary: 'Obtenir les statistiques des compétences douces' })
  @ApiResponse({ status: 200, description: 'Statistiques des compétences douces' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getSoftSkillsStats() {
    return this.studentPreferenceService.getStatsBySoftSkills();
  }

  @Get('stats/language/:language')
  @ApiOperation({ summary: 'Obtenir les statistiques des niveaux de langue' })
  @ApiResponse({ status: 200, description: 'Statistiques des niveaux de langue' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getLanguageStats(@Param('language') language: string) {
    return this.studentPreferenceService.getStatsByLanguage(language);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer les préférences par ID' })
  @ApiResponse({ status: 200, description: 'Préférences trouvées' })
  @ApiResponse({ status: 404, description: 'Préférences non trouvées' })
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    return this.studentPreferenceService.findOne(id);
  }

  @Patch('my-preferences')
  @ApiOperation({ summary: 'Modifier les préférences de l\'utilisateur connecté' })
  @ApiResponse({ status: 200, description: 'Préférences modifiées avec succès' })
  @ApiResponse({ status: 404, description: 'Préférences non trouvées' })
  @UseGuards(JwtAuthGuard)
  async updateByUser(
    @Body() updateStudentPreferenceDto: UpdateStudentPreferenceDto,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.studentPreferenceService.updateByUser(userId, updateStudentPreferenceDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier les préférences par ID' })
  @ApiResponse({ status: 200, description: 'Préférences modifiées avec succès' })
  @ApiResponse({ status: 404, description: 'Préférences non trouvées' })
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateStudentPreferenceDto: UpdateStudentPreferenceDto,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.studentPreferenceService.update(id, updateStudentPreferenceDto, userId);
  }

  @Delete('my-preferences')
  @ApiOperation({ summary: 'Supprimer les préférences de l\'utilisateur connecté' })
  @ApiResponse({ status: 200, description: 'Préférences supprimées avec succès' })
  @ApiResponse({ status: 404, description: 'Préférences non trouvées' })
  @UseGuards(JwtAuthGuard)
  async removeByUser(@CurrentUser() user: any) {
    const userId = user.userId || user._id || user.id;
    return this.studentPreferenceService.removeByUser(userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer les préférences par ID' })
  @ApiResponse({ status: 200, description: 'Préférences supprimées avec succès' })
  @ApiResponse({ status: 404, description: 'Préférences non trouvées' })
  @UseGuards(JwtAuthGuard)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.studentPreferenceService.remove(id, userId);
  }
}