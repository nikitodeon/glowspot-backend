import { Module } from '@nestjs/common'

import { PrismaService } from '@/src/core/prisma/prisma.service'

import { EventsResolver } from './events.resolver'
import { EventsService } from './events.service'

@Module({
	providers: [EventsResolver, EventsService, PrismaService]
})
export class EventsModule {}
