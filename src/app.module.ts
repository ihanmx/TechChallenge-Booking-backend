import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { appValidationPipe } from './common/pipes/validation.pipe.js';
import { SlotsModule } from './slots/slots.module.js';
import { BookingsModule } from './bookings/bookings.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    SlotsModule,
    BookingsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Registered here (not in main.ts) so e2e tests get the exact same behavior.
    { provide: APP_PIPE, useValue: appValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
