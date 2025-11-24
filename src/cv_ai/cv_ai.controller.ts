import { Body, Controller, Post, UseGuards, Req } from "@nestjs/common";
import { CvAiService } from "./cv_ai.service";
import { AuthGuard } from "@nestjs/passport";

@Controller("cv-ai")
export class CvAiController {
  constructor(private readonly cvAiService: CvAiService) {}

  @UseGuards(AuthGuard("jwt"))
  @Post("analyze-image")
  async analyzeImage(@Body("image") base64: string, @Req() req: any) {
    if (!base64 || base64.length < 50) {
      return { error: "Image base64 invalid" };
    }

    const profile = await this.cvAiService.analyzeImage(base64);

    return {
      userId: req.user?.sub,
      profile,
    };
  }
}