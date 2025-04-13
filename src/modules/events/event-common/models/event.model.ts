import { Field, ObjectType } from '@nestjs/graphql'
import { registerEnumType } from '@nestjs/graphql'
import { EventProperty, EventType, PaymentType } from '@prisma/generated'
import { EventStatus } from '@prisma/generated'

import { UserModel } from '../../../auth/account/models/user.model'

import { LocationModel } from './location.model'

registerEnumType(EventType, { name: 'EventType' })
registerEnumType(EventProperty, { name: 'EventProperty' })
registerEnumType(PaymentType, { name: 'PaymentType' })
registerEnumType(EventStatus, { name: 'EventStatus' })

@ObjectType()
export class EventModel {
	@Field()
	id: string

	@Field()
	title: string

	@Field()
	description: string

	@Field()
	startTime: Date

	@Field({ nullable: true })
	endTime?: Date

	@Field(() => [String])
	photoUrls: string[]

	@Field(() => EventType)
	eventType: EventType

	@Field(() => [EventProperty])
	eventProperties: EventProperty[]

	@Field(() => PaymentType)
	paymentType: PaymentType

	@Field({ nullable: true })
	price?: number

	@Field({ nullable: true })
	currency?: string

	@Field()
	postedDate: Date

	@Field()
	isVerified: boolean

	@Field()
	isPrivate: boolean

	@Field({ nullable: true })
	maxParticipants?: number

	@Field(() => [String])
	tags: string[]

	@Field(() => EventStatus)
	status: EventStatus

	@Field({ nullable: true })
	ageRestriction?: number

	@Field(() => LocationModel)
	location: LocationModel

	@Field(() => UserModel)
	organizer: UserModel

	@Field(() => [UserModel], { nullable: true })
	participants?: UserModel[]

	@Field(() => [UserModel], { nullable: true })
	favoritedBy?: UserModel[]

	@Field()
	createdAt: Date

	@Field()
	updatedAt: Date
}
