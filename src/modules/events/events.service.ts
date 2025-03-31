import {
	ConflictException,
	Injectable,
	NotFoundException
} from '@nestjs/common'
import axios from 'axios'
//   import { UpdateEventInput } from './inputs/update-event.input';
//   import { EventStatus, EventType, PaymentType, User } from '@prisma/client';
import * as wkt from 'wkt'

import { PrismaService } from '@/src/core/prisma/prisma.service'

import { CreateEventInput } from './inputs/create-event.input'

@Injectable()
export class EventsService {
	constructor(private readonly prisma: PrismaService) {}

	async getAllEvents() {
		const events = await this.prisma.event.findMany({
			where: {
				isPrivate: false
			},
			include: {
				location: true,
				organizer: true
			},
			orderBy: {
				startTime: 'asc'
			}
		})

		// Process coordinates for each event
		return Promise.all(
			events.map(async event => {
				const coordinates: { coordinates: string }[] = await this.prisma
					.$queryRaw`
              SELECT ST_AsText(coordinates) as coordinates FROM "Location" WHERE id = ${event.location.id}
            `

				const geoJSON = wkt.parse(coordinates[0]?.coordinates || '')
				const [longitude, latitude] = geoJSON.coordinates

				return {
					...event,
					location: {
						...event.location,
						coordinates: {
							longitude,
							latitude
						}
					}
				}
			})
		)
	}

	private async geocodeAddress(
		address: string,
		city: string = 'Minsk'
	): Promise<{ longitude: number; latitude: number }> {
		try {
			const geocodingUrl = `https://nominatim.openstreetmap.org/search?${new URLSearchParams(
				{
					q: `${address}, ${city}`,
					format: 'json',
					limit: '1'
				}
			).toString()}`

			const response = await axios.get(geocodingUrl, {
				headers: {
					'User-Agent': 'EventApp (your@email.com)'
				}
			})

			if (response.data.length > 0) {
				return {
					longitude: parseFloat(response.data[0].lon),
					latitude: parseFloat(response.data[0].lat)
				}
			}
			return { longitude: 0, latitude: 0 }
		} catch (error) {
			console.error('Geocoding error:', error)
			return { longitude: 0, latitude: 0 }
		}
	}

	async createEvent(input: CreateEventInput, organizerId: string) {
		const { address, city, placeName, ...eventData } = input
		console.log({
			title: eventData.title,
			description: eventData.description,
			startTime: eventData.startTime,
			endTime: eventData.endTime,
			photoUrls: eventData.photoUrls,
			eventType: eventData.eventType,
			eventProperties: eventData.eventProperties,
			paymentType: eventData.paymentType,
			address,
			city,
			placeName,
			isPrivate: eventData.isPrivate,
			tags: eventData.tags,
			ageRestriction: eventData.ageRestriction
		})
		const { longitude, latitude } = await this.geocodeAddress(address, city)
		if (longitude === 0 || latitude === 0) {
			console.error('Invalid coordinates:', longitude, latitude)
			throw new Error('Geocoding failed')
		}
		// Create location first
		console.log(
			'Geocoded coordinates:яяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяя',
			{ longitude, latitude }
		)
		console.log(
			'Final values before insert:яяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяяя',
			{
				address,
				city,
				placeName,
				longitude,
				latitude
			}
		)
		const location = await this.prisma.$queryRaw`
        
  INSERT INTO "locations" (address, city, "place_name", coordinates)
  VALUES (${address}, ${city || 'Minsk'}, ${placeName || 'Default Place'}, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326))
  RETURNING id, address, city, "place_name", ST_AsText(coordinates) as coordinates;
-- INSERT INTO "locations" (address, city, "place_name", coordinates)
-- VALUES ('ул. Слободская', 'Минск', 'Тестовое место', 
--         ST_SetSRID(ST_MakePoint(27.454465624020376, 53.8452343142866), 4326));

`

		const locationId = location?.[0].id
		console.log('locationId:kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk', locationId)
		return this.prisma.event.create({
			data: {
				...eventData,
				organizerId,
				locationId,
				status: 'UPCOMING'
			},
			include: {
				location: true,
				organizer: true
			}
		})
	}
}
