import { Controller, Get } from '@nestjs/common';
import { SlotsService } from './slots.service.js';
import { SlotsResponseDto } from './dto/slot.dto.js';

@Controller('slots')
export class SlotsController {
  constructor(private readonly slotsService: SlotsService) {}

  @Get()
  async findAvailable(): Promise<SlotsResponseDto> {
    return { slots: await this.slotsService.findAvailable() };
  }
}
