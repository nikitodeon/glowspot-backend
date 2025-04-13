import { Field, ObjectType } from '@nestjs/graphql'
import { Location as PrismaLocation } from '@prisma/generated'

@ObjectType()
export class Coordinates {
	@Field()
	longitude: number

	@Field()
	latitude: number
}

@ObjectType()
export class LocationModel implements Omit<PrismaLocation, 'coordinates'> {
	@Field()
	id: string

	@Field(() => String, { nullable: true })
	address: string | null

	@Field()
	city: string

	@Field(() => String, { nullable: true })
	placeName: string | null

	@Field(() => Coordinates)
	coordinates: Coordinates

	@Field()
	createdAt: Date

	@Field()
	updatedAt: Date
}
