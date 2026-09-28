import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { trim } from '../../common/transforms/trim.js';

export class CreateBookingDto {
  @ApiProperty({
    format: 'uuid',
    example: '11111111-1111-4111-8111-111111111101',
    description: 'ID of an available slot (see GET /slots).',
  })
  @IsUUID('all', { message: 'slotId must be a UUID' })
  slotId: string;

  @ApiProperty({
    example: 'Alex Morgan',
    minLength: 1,
    description: 'Trimmed before validation and storage; must not be empty.',
  })
  @Transform(trim)
  @IsString({ message: 'customerName must be a string' })
  @IsNotEmpty({ message: 'customerName must not be empty' })
  customerName: string;

  @ApiProperty({
    format: 'email',
    example: 'alex@example.com',
    description: 'Trimmed before validation and storage; must be a valid email address.',
  })
  @Transform(trim)
  @IsString({ message: 'customerEmail must be a string' })
  @IsEmail({}, { message: 'customerEmail must be a valid email address' })
  customerEmail: string;
}
