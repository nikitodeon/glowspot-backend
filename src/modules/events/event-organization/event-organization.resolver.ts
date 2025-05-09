import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql'
import { User } from '@prisma/generated'
import * as GraphQLUpload from 'graphql-upload/GraphQLUpload.js'

import { Authorization } from '@/src/shared/decorators/auth.decorator'
import { Authorized } from '@/src/shared/decorators/authorized.decorator'
import { GqlAuthGuard } from '@/src/shared/guards/gql-auth.guard'

import { EventModel } from '../event-common/models/event.model'

import { EventOrganizationService } from './event-organization.service'
import { CreateEventInput } from './inputs/create-event.input'
import { UpdateEventInput } from './inputs/update-event.input'

@Resolver(() => EventModel)
export class EventOrganizationResolver {
	constructor(
		private readonly eventOrganizationService: EventOrganizationService
	) {}

	@Authorization()
	@Mutation(() => EventModel)
	@UseGuards(GqlAuthGuard)
	async createEvent(
		@Args('input') input: CreateEventInput,
		@Args('photos', { type: () => [GraphQLUpload], nullable: true })
		photos: Promise<any>[],
		@Authorized() user: User
	) {
		const resolvedPhotos = await Promise.all(photos)
		return this.eventOrganizationService.createEvent(
			input,
			user.id,
			resolvedPhotos
		)
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
		return this.eventOrganizationService.updateEvent(
			id,
			input,
			user.id,
			resolvedPhotos
		)
	}

	@Authorization()
	@Mutation(() => Boolean)
	@UseGuards(GqlAuthGuard)
	async deleteEvent(@Args('id') id: string, @Authorized() user: User) {
		return this.eventOrganizationService.deleteEvent(id, user.id)
	}

	@Authorization()
	@Query(() => [EventModel], { name: 'getMyOrganizedEvents' })
	async getMyOrganizedEvents(@Authorized() user: User) {
		return this.eventOrganizationService.getEventsByOrganizer(user.id)
	}
}
