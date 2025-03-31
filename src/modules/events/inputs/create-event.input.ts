import { Field, InputType } from '@nestjs/graphql'
import { EventProperty, EventType, PaymentType } from 'prisma/generated'

@InputType()
export class CreateEventInput {
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
	address: string

	@Field({ nullable: true })
	city?: string

	@Field({ nullable: true })
	placeName?: string

	@Field()
	isPrivate: boolean

	@Field({ nullable: true })
	maxParticipants?: number

	@Field(() => [String])
	tags: string[]

	@Field({ nullable: true })
	ageRestriction?: number
}
