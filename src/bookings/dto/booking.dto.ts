import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from '../../generated/prisma/enums.js';

export class BookingDto {
  @ApiProperty({ format: 'uuid', example: '22222222-2222-4222-8222-222222222222' })
  id: string;

  @ApiProperty({ format: 'uuid', example: '11111111-1111-4111-8111-111111111101' })
  slotId: string;

  @ApiProperty({ example: 'Alex Morgan' })
  customerName: string;

  @ApiProperty({ format: 'email', example: 'alex@example.com' })
  customerEmail: string;

  @ApiProperty({ enum: BookingStatus, enumName: 'BookingStatus', example: 'active' })
  status: BookingStatus;
}

export class BookingResponseDto {
  @ApiProperty({ type: BookingDto })
  booking: BookingDto;
}
