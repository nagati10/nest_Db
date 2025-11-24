import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { CvAiService } from "./cv_ai.service";
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller("cv-ai")
export class CvAiController {
  constructor(private readonly cvService: CvAiService) {}

  // image endpoint
  @UseGuards(JwtAuthGuard)
  @Post("analyze-image")
  async analyzeImage(@Body("image") base64: string, @Req() req: any) {
    // هنا req عندك فيه user لو تحب تستعملو
    return await this.cvService.analyzeImage(base64);
  }

  // text endpoint
  @UseGuards(JwtAuthGuard)
  @Post("analyze-text")
  async analyzeText(@Body("text") text: string) {
    return await this.cvService.analyzeText(text);
  }
}
