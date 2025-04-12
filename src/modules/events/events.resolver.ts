import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql'
import { User } from '@prisma/generated'
import * as GraphQLUpload from 'graphql-upload/GraphQLUpload.js'

// import * as Upload from 'graphql-upload/Upload.js'

import { Authorization } from '@/src/shared/decorators/auth.decorator'
import { Authorized } from '@/src/shared/decorators/authorized.decorator'
import { GqlAuthGuard } from '@/src/shared/guards/gql-auth.guard'

import { EventsService } from './events.service'
import { CreateEventInput } from './inputs/create-event.input'
import { EventFilterInput } from './inputs/event-filter.input'
import { UpdateEventInput } from './inputs/update-event.input'
// import { UpdateEventInput } from './inputs/update-event.input';
import { EventModel } from './models/event.model'

@Resolver(() => EventModel)
export class EventsResolver {
	constructor(private readonly eventsService: EventsService) {}

	@Query(() => [EventModel], { name: 'getAllEvents' })
	@UseGuards(GqlAuthGuard)
	async getAllEvents(
		@Args('filter', { type: () => EventFilterInput, nullable: true })
		filter?: EventFilterInput
	) {
		return this.eventsService.getAllEvents(filter)
	}

	@Authorization()
	@Mutation(() => EventModel)
	@UseGuards(GqlAuthGuard)
	async createEvent(
		@Args('input') input: CreateEventInput,
		@Args('photos', { type: () => [GraphQLUpload], nullable: true })
		photos: Promise<any>[], // Изменено на Promise<FileUpload>[]
		@Authorized() user: User
	) {
		// Дожидаемся разрешения всех промисов
		const resolvedPhotos = await Promise.all(photos)
		return this.eventsService.createEvent(input, user.id, resolvedPhotos)
	}
	@Authorization()
	@Mutation(() => EventModel)
	@UseGuards(GqlAuthGuard)
	async updateEvent(
		@Args('id') id: string,
		@Args('input') input: UpdateEventInput,
		@Args('photos', { type: () => [GraphQLUpload], nullable: true })
		photos: Promise<any>[],
		@Authorized() user: User
	) {
		const resolvedPhotos = await Promise.all(photos)
		return this.eventsService.updateEvent(
			id,
			input,
			user.id,
			resolvedPhotos
		)
	}

	@Query(() => EventModel, { name: 'getEventById' })
	async getEventById(@Args('id') id: string) {
		return this.eventsService.getEventById(id)
	}

	@Authorization()
	@Mutation(() => Boolean)
	@UseGuards(GqlAuthGuard)
	async deleteEvent(@Args('id') id: string, @Authorized() user: User) {
		return this.eventsService.deleteEvent(id, user.id)
	}

	@Authorization()
	@Query(() => [EventModel], { name: 'getMyOrganizedEvents' })
	async getMyOrganizedEvents(@Authorized() user: User) {
		return this.eventsService.getEventsByOrganizer(user.id)
	}
	@Authorization()
	@Mutation(() => Boolean)
	@UseGuards(GqlAuthGuard)
	async participateInEvent(
		@Args('eventId') eventId: string,
		@Authorized() user: User
	) {
		return this.eventsService.participateInEvent(eventId, user.id)
	}
	// В вашем resolver-файле (например, events.resolver.ts)
	@Authorization()
	@Mutation(() => Boolean)
	@UseGuards(GqlAuthGuard)
	async leaveEvent(
		@Args('eventId') eventId: string,
		@Authorized() user: User
	) {
		return this.eventsService.leaveEvent(eventId, user.id)
	}
	@Authorization()
	@Query(() => [EventModel], { name: 'getEventsWhereIParticipate' })
	@UseGuards(GqlAuthGuard)
	async getEventsWhereIParticipate(@Authorized() user: User) {
		return this.eventsService.getEventsWhereIParticipate(user.id)
	}

	@Authorization()
	@Mutation(() => Boolean)
	@UseGuards(GqlAuthGuard)
	async addToFavorites(
		@Args('eventId') eventId: string,
		@Authorized() user: User
	): Promise<boolean> {
		console.log(`User ${user.id} is adding event ${eventId} to favorites`)
		try {
			const result = await this.eventsService.addToFavorites(
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
			const result = await this.eventsService.removeFromFavorites(
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
			const favorites = await this.eventsService.getFavoriteEvents(
				user.id
			)
			console.log(`Found ${favorites.length} favorite events`)
			return favorites
		} catch (error) {
			console.error('Error in getFavoriteEvents resolver:', error)
			throw error
		}
	}
}
