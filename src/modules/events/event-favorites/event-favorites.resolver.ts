import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql'
import { User } from '@prisma/generated'

import { Authorization } from '@/src/shared/decorators/auth.decorator'
import { Authorized } from '@/src/shared/decorators/authorized.decorator'
import { GqlAuthGuard } from '@/src/shared/guards/gql-auth.guard'

import { EventModel } from '../event-common/models/event.model'

import { EventFavoritesService } from './event-favorites.service'

@Resolver(() => EventModel)
export class EventFavoritesResolver {
	constructor(
		private readonly eventFavoritesService: EventFavoritesService
	) {}

	@Authorization()
	@Mutation(() => Boolean)
	@UseGuards(GqlAuthGuard)
	async addToFavorites(
		@Args('eventId') eventId: string,
		@Authorized() user: User
	): Promise<boolean> {
		console.log(`User ${user.id} is adding event ${eventId} to favorites`)
		try {
			const result = await this.eventFavoritesService.addToFavorites(
				eventId,
				user.id
			)
			console.log(
				`Event ${eventId} added to favorites by user ${user.id}: ${result}`
			)
			return result
		} catch (error) {
			console.error('Error adding event to favorites:', error)
			throw error
		}
	}

	@Authorization()
	@Mutation(() => Boolean)
	@UseGuards(GqlAuthGuard)
	async removeFromFavorites(
		@Args('eventId') eventId: string,
		@Authorized() user: User
	): Promise<boolean> {
		console.log(
			`User ${user.id} is removing event ${eventId} from favorites`
		)
		try {
			const result = await this.eventFavoritesService.removeFromFavorites(
				eventId,
				user.id
			)
			console.log(
				`Event ${eventId} removed from favorites by user ${user.id}: ${result}`
			)
			return result
		} catch (error) {
			console.error('Error removing event from favorites:', error)
			throw error
		}
	}

	@Authorization()
	@Query(() => [EventModel], {
		name: 'getFavoriteEvents',
		description: 'Возвращает список избранных событий пользователя'
	})
	@UseGuards(GqlAuthGuard)
	async getFavoriteEvents(@Authorized() user: User) {
		console.log(`Fetching favorite events for user ${user.id}`)
		try {
			const favorites =
				await this.eventFavoritesService.getFavoriteEvents(user.id)
			console.log(`Found ${favorites.length} favorite events`)
			return favorites
		} catch (error) {
			console.error('Error in getFavoriteEvents resolver:', error)
			throw error
		}
	}
}
