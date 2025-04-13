import { Module } from '@nestjs/common'

import { PrismaService } from '@/src/core/prisma/prisma.service'

import { EventFavoritesResolver } from './event-favorites.resolver'
import { EventFavoritesService } from './event-favorites.service'

@Module({
	providers: [EventFavoritesService, EventFavoritesResolver, PrismaService]
})
export class EventFavoritesModule {}
