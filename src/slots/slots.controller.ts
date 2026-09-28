import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiInternalError } from '../common/swagger/api-error-response.decorator.js';
import { SlotsService } from './slots.service.js';
import { SlotsResponseDto } from './dto/slot.dto.js';

@ApiTags('Slots')
@Controller('slots')
export class SlotsController {
  constructor(private readonly slotsService: SlotsService) {}

  @Get()
  @ApiOperation({
    summary: 'List available slots',
    description:
      'Returns only slots with **no active booking**, ordered by `startsAt` then `id` (ascending). ' +
      'A slot whose bookings are all cancelled is available again. ' +
      'No date-based rules and no pagination. Returns `{"slots":[]}` when nothing is available.',
  })
  @ApiOkResponse({
    type: SlotsResponseDto,
    description: 'Available slots (possibly empty).',
    examples: {
      available: {
        summary: 'Available slots',
        value: {
          slots: [
            {
              id: '11111111-1111-4111-8111-111111111101',
              startsAt: '2030-01-15T09:00:00.000Z',
              endsAt: '2030-01-15T09:30:00.000Z',
            },
            {
              id: '11111111-1111-4111-8111-111111111102',
              startsAt: '2030-01-15T09:30:00.000Z',
              endsAt: '2030-01-15T10:00:00.000Z',
            },
          ],
        },
      },
      empty: { summary: 'No available slots', value: { slots: [] } },
    },
  })
  @ApiInternalError()
  async findAvailable(): Promise<SlotsResponseDto> {
    return { slots: await this.slotsService.findAvailable() };
  }
}
