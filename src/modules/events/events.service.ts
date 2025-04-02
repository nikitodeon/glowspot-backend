import {
	ConflictException,
	Injectable,
	NotFoundException
} from '@nestjs/common'
import axios from 'axios'
import * as Upload from 'graphql-upload/Upload.js'
import * as sharp from 'sharp'
//   import { UpdateEventInput } from './inputs/update-event.input';
//   import { EventStatus, EventType, PaymentType, User } from '@prisma/client';
import * as wkt from 'wkt'

import {
	EventProperty,
	EventStatus,
	EventType,
	PaymentType
} from '@/prisma/generated'
import { PrismaService } from '@/src/core/prisma/prisma.service'

import { StorageService } from '../libs/storage/storage.service'

import { CreateEventInput } from './inputs/create-event.input'
import { EventModel } from './models/event.model'

type EventWithDetails = {
	id: string
	title: string
	description: string
	start_time: Date
	end_time: Date | null
	photo_urls: string[]
	eventType: EventType
	eventProperties: EventProperty[]
	paymentType: PaymentType
	price: number | null
	currency: string | null
	posted_date: Date
	is_verified: boolean
	is_private: boolean
	max_participants: number | null
	tags: string[]
	status: EventStatus
	age_restriction: number | null
	created_at: Date
	updated_at: Date
	location_id: string
	address: string | null
	city: string
	place_name: string | null
	longitude: number
	latitude: number
	organizer_id: string
	username: string
	display_name: string
	avatar: string | null
	participants: Array<{
		id: string
		username: string
		display_name: string
		avatar: string | null
	}>
}

@Injectable()
export class EventsService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly storageService: StorageService
	) {}

	async getAllEvents() {
		try {
			type EventWithLocation = {
				id: string
				title: string
				description: string
				start_time: Date
				end_time: Date | null
				photo_urls: string[]
				eventType: EventType // Обратите внимание - camelCase
				eventProperties: EventProperty[] // camelCase
				paymentType: PaymentType // camelCase
				price: number | null
				currency: string | null
				posted_date: Date
				is_verified: boolean
				is_private: boolean
				max_participants: number | null
				tags: string[]
				status: EventStatus
				age_restriction: number | null
				created_at: Date
				updated_at: Date
				locationId: string // camelCase
				address: string | null
				city: string
				place_name: string | null
				longitude: number
				latitude: number
				organizerId: string // camelCase
				username: string
				display_name: string
				avatar: string | null
				participants: Array<{
					id: string
					username: string
					display_name: string
					avatar: string | null
				}>
			}

			const events = await this.prisma.$queryRaw<EventWithLocation[]>`
			SELECT 
			  e.id,
			  e.title,
			  e.description,
			  e.start_time,
			  e.end_time,
			  e.photo_urls,
			  e."eventType" as "eventType",
			  e."eventProperties" as "eventProperties",
			  e."paymentType" as "paymentType",
			  e.price,
			  e.currency,
			  e.posted_date,
			  e.is_verified,
			  e.is_private,
			  e.max_participants,
			  e.tags,
			  e.status,
			  e.age_restriction,
			  e.created_at,
			  e.updated_at,
			  l.id as "locationId",
			  l.address,
			  l.city,
			  l.place_name,
			  ST_X(l.coordinates::geometry) as longitude,
			  ST_Y(l.coordinates::geometry) as latitude,
			  u.id as "organizerId",
			  u.username,
			  u.display_name,
			  u.avatar,
			  (
          SELECT json_agg(json_build_object(
            'id', p.id,
            'username', p.username,
            'display_name', p.display_name,
            'avatar', p.avatar
          ))
          FROM "_EventParticipants" ep
          JOIN "users" p ON ep."B" = p.id
          WHERE ep."A" = e.id
        ) as participants
			FROM "events" e
			JOIN "locations" l ON e."locationId" = l.id
			JOIN "users" u ON e."organizerId" = u.id
			
			WHERE e.is_private = false
			ORDER BY e.start_time ASC
		  `

			return events.map(event => ({
				id: event.id,
				title: event.title,
				description: event.description,
				startTime: event.start_time,
				endTime: event.end_time,
				photoUrls: event.photo_urls,
				eventType: event.eventType, // Без преобразования
				eventProperties: event.eventProperties, // Без преобразования
				paymentType: event.paymentType, // Без преобразования
				price: event.price,
				currency: event.currency,
				postedDate: event.posted_date,
				isVerified: event.is_verified,
				isPrivate: event.is_private,
				maxParticipants: event.max_participants,
				tags: event.tags,
				status: event.status,
				ageRestriction: event.age_restriction,
				createdAt: event.created_at,
				updatedAt: event.updated_at,
				location: {
					id: event.locationId, // Без преобразования
					address: event.address,
					city: event.city,
					placeName: event.place_name,
					coordinates: {
						longitude: event.longitude,
						latitude: event.latitude
					},
					createdAt: event.created_at,
					updatedAt: event.updated_at
				},
				organizer: {
					id: event.organizerId, // Без преобразования
					username: event.username,
					displayName: event.display_name,
					avatar: event.avatar
				},
				participants: event.participants
					? event.participants.map(p => ({
							id: p.id,
							username: p.username,
							displayName: p.display_name,
							avatar: p.avatar
						}))
					: []
			}))
		} catch (error) {
			console.error('Error fetching events:', error)
			throw new Error('Failed to fetch events')
		}
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

	async createEvent(
		input: CreateEventInput,
		organizerId: string,
		photos?: any[]
	) {
		const { address, city, placeName, ...eventData } = input
		const { longitude, latitude } = await this.geocodeAddress(address, city)

		if (longitude === 0 || latitude === 0) {
			throw new Error('Geocoding failed')
		}

		try {
			// 1. Create location
			const locations = await this.prisma.$queryRaw<{ id: string }[]>`
		  INSERT INTO "locations" 
			(id, address, city, "place_name", coordinates, "created_at", "updated_at")
		  VALUES (
			gen_random_uuid(),
			${address || null}, 
			${city || 'Minsk'}, 
			${placeName || null}, 
			ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326),
			NOW(),
			NOW()
		  )
		  RETURNING id;
		  `

			if (!locations || locations.length === 0) {
				throw new Error('Failed to create location')
			}

			const locationId = locations[0].id

			// Process photos if provided
			const photoPaths: string[] = []
			if (photos && photos.length > 0) {
				for (const photo of photos) {
					const chunks: Buffer[] = []
					for await (const chunk of photo.createReadStream()) {
						chunks.push(chunk)
					}
					const buffer = Buffer.concat(chunks)

					const fileName = `/events/${organizerId}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.webp`

					const processedBuffer = await sharp(buffer)
						.resize(1280, 720)
						.webp()
						.toBuffer()

					await this.storageService.upload(
						processedBuffer,
						fileName,
						'image/webp'
					)

					photoPaths.push(fileName)
				}
			}

			// Фильтруем входные photoUrls, оставляя только те, что похожи на пути в хранилище
			const filteredInputPaths = (eventData.photoUrls || []).filter(
				path =>
					path.startsWith('/events/') || path.startsWith('/users/')
			)

			const allPhotoPaths = [...photoPaths, ...filteredInputPaths]

			const event = await this.prisma.event.create({
				data: {
					title: eventData.title,
					description: eventData.description,
					startTime: eventData.startTime,
					endTime: eventData.endTime || null,
					photoUrls: allPhotoPaths, // Сохраняем только пути
					eventType: eventData.eventType,
					eventProperties: eventData.eventProperties || [],
					paymentType: eventData.paymentType,
					price: eventData.price || null,
					currency: eventData.currency || 'BYN',
					isPrivate: eventData.isPrivate || false,
					maxParticipants: eventData.maxParticipants || null,
					tags: eventData.tags || [],
					ageRestriction: eventData.ageRestriction || null,
					status: 'UPCOMING',
					postedDate: new Date(),
					locationId,
					organizerId,
					participants: {
						connect: { id: organizerId }
					}
				},
				include: {
					location: true,
					organizer: true,
					participants: true
				}
			})

			return event
		} catch (err) {
			console.error('Error creating event:', err)
			throw new Error('Failed to create event')
		}
	}
	async getEventById(id: string) {
		try {
			const events = await this.prisma.$queryRaw<EventWithDetails[]>`
			SELECT 
			  e.*,
			  l.id as location_id,
			  l.address,
			  l.city,
			  l.place_name,
			  ST_X(l.coordinates::geometry) as longitude,
			  ST_Y(l.coordinates::geometry) as latitude,
			  u.id as organizer_id,
			  u.username,
			  u.display_name,
			  u.avatar
			FROM events e
			JOIN locations l ON e."locationId" = l.id
			JOIN users u ON e."organizerId" = u.id
			WHERE e.id = ${id}
		  `

			if (!events || events.length === 0) {
				throw new NotFoundException('Event not found')
			}

			const event = events[0]
			return this.mapEventWithDetails(event)
		} catch (error) {
			console.error('Error fetching event:', error)
			throw new Error('Failed to fetch event')
		}
	}
	private mapEventWithDetails(event: EventWithDetails) {
		return {
			id: event.id,
			title: event.title,
			description: event.description,
			startTime: event.start_time,
			endTime: event.end_time,
			photoUrls: event.photo_urls,
			eventType: event.eventType,
			eventProperties: event.eventProperties,
			paymentType: event.paymentType,
			price: event.price,
			currency: event.currency,
			postedDate: event.posted_date,
			isVerified: event.is_verified,
			isPrivate: event.is_private,
			maxParticipants: event.max_participants,
			tags: event.tags,
			status: event.status,
			ageRestriction: event.age_restriction,
			createdAt: event.created_at,
			updatedAt: event.updated_at,
			location: {
				id: event.location_id,
				address: event.address,
				city: event.city,
				placeName: event.place_name,
				coordinates: {
					longitude: event.longitude,
					latitude: event.latitude
				}
			},
			organizer: {
				id: event.organizer_id,
				username: event.username,
				displayName: event.display_name,
				avatar: event.avatar
			}
		}
	}

	async getEventsByOrganizer(organizerId: string) {
		try {
			const events = await this.prisma.$queryRaw<EventWithDetails[]>`
			SELECT 
			  e.*,
			  l.id as location_id,
			  l.address,
			  l.city,
			  l.place_name,
			  ST_X(l.coordinates::geometry) as longitude,
			  ST_Y(l.coordinates::geometry) as latitude,
			  u.id as organizer_id,
			  u.username,
			  u.display_name,
			  u.avatar
			FROM events e
			JOIN locations l ON e."locationId" = l.id
			JOIN users u ON e."organizerId" = u.id
			WHERE e."organizerId" = ${organizerId}
			ORDER BY e.start_time ASC
		  `

			return events.map(event => this.mapEventWithDetails(event))
		} catch (error) {
			console.error('Error fetching organizer events:', error)
			throw new Error('Failed to fetch organizer events')
		}
	}

	async participateInEvent(eventId: string, userId: string) {
		try {
			// Проверяем, что событие существует
			const event = await this.prisma.event.findUnique({
				where: { id: eventId }
			})

			if (!event) {
				throw new NotFoundException('Event not found')
			}

			// Проверяем, что пользователь еще не участник
			const existingParticipation = await this.prisma.event.findFirst({
				where: {
					id: eventId,
					participants: { some: { id: userId } }
				}
			})

			if (existingParticipation) {
				throw new ConflictException(
					'User already participates in this event'
				)
			}

			// Добавляем участника
			await this.prisma.event.update({
				where: { id: eventId },
				data: {
					participants: {
						connect: { id: userId }
					}
				}
			})

			return true
		} catch (error) {
			console.error('Error participating in event:', error)
			throw error
		}
	}

	async getEventsWhereIParticipate(userId: string) {
		try {
			type EventWithDetails = {
				id: string
				title: string
				description: string
				start_time: Date
				end_time: Date | null
				photo_urls: string[]
				eventType: EventType
				eventProperties: EventProperty[]
				paymentType: PaymentType
				price: number | null
				currency: string | null
				posted_date: Date
				is_verified: boolean
				is_private: boolean
				max_participants: number | null
				tags: string[]
				status: EventStatus
				age_restriction: number | null
				created_at: Date
				updated_at: Date
				location_id: string
				address: string | null
				city: string
				place_name: string | null
				longitude: number
				latitude: number
				organizer_id: string
				username: string
				display_name: string
				avatar: string | null
				participants: Array<{
					id: string
					username: string
					display_name: string
					avatar: string | null
				}>
			}

			const events = await this.prisma.$queryRaw<EventWithDetails[]>`
			SELECT 
			  e.*,
			  l.id as location_id,
			  l.address,
			  l.city,
			  l.place_name,
			  ST_X(l.coordinates::geometry) as longitude,
			  ST_Y(l.coordinates::geometry) as latitude,
			  u.id as organizer_id,
			  u.username,
			  u.display_name,
			  u.avatar,
			  (
          SELECT json_agg(json_build_object(
            'id', p.id,
            'username', p.username,
            'display_name', p.display_name,
            'avatar', p.avatar
          ))
          FROM "_EventParticipants" ep
          JOIN "users" p ON ep."B" = p.id
          WHERE ep."A" = e.id
        ) as participants
			FROM "events" e
			JOIN "locations" l ON e."locationId" = l.id
			JOIN "users" u ON e."organizerId" = u.id
			JOIN "_EventParticipants" ep ON e.id = ep."A"
			WHERE ep."B" = ${userId}
			ORDER BY e.start_time ASC
		  `

			return events.map(event => ({
				id: event.id,
				title: event.title,
				description: event.description,
				startTime: event.start_time,
				endTime: event.end_time,
				photoUrls: event.photo_urls,
				eventType: event.eventType,
				eventProperties: event.eventProperties,
				paymentType: event.paymentType,
				price: event.price,
				currency: event.currency,
				postedDate: event.posted_date,
				isVerified: event.is_verified,
				isPrivate: event.is_private,
				maxParticipants: event.max_participants,
				tags: event.tags,
				status: event.status,
				ageRestriction: event.age_restriction,
				createdAt: event.created_at,
				updatedAt: event.updated_at,
				location: {
					id: event.location_id,
					address: event.address,
					city: event.city,
					placeName: event.place_name,
					coordinates: {
						longitude: event.longitude,
						latitude: event.latitude
					}
				},
				organizer: {
					id: event.organizer_id,
					username: event.username,
					displayName: event.display_name,
					avatar: event.avatar
				},
				participants: event.participants
					? event.participants.map(p => ({
							id: p.id,
							username: p.username,
							displayName: p.display_name,
							avatar: p.avatar
						}))
					: []
			}))
		} catch (error) {
			console.error('Error fetching events where I participate:', error)
			throw new Error('Failed to fetch events where I participate')
		}
	}
	async addToFavorites(eventId: string, userId: string) {
		try {
			// Проверяем, что событие существует
			const event = await this.prisma.event.findUnique({
				where: { id: eventId }
			})

			if (!event) {
				throw new NotFoundException('Event not found')
			}

			// Проверяем, что событие еще не в избранном
			const existingFavorite = await this.prisma.user.findFirst({
				where: {
					id: userId,
					favorites: { some: { id: eventId } }
				}
			})

			if (existingFavorite) {
				throw new ConflictException('Event already in favorites')
			}

			// Добавляем в избранное
			await this.prisma.user.update({
				where: { id: userId },
				data: {
					favorites: {
						connect: { id: eventId }
					}
				}
			})

			return true
		} catch (error) {
			console.error('Error adding to favorites:', error)
			throw error
		}
	}

	async removeFromFavorites(eventId: string, userId: string) {
		try {
			// Проверяем, что событие существует
			const event = await this.prisma.event.findUnique({
				where: { id: eventId }
			})

			if (!event) {
				throw new NotFoundException('Event not found')
			}

			// Проверяем, что событие в избранном
			const existingFavorite = await this.prisma.user.findFirst({
				where: {
					id: userId,
					favorites: { some: { id: eventId } }
				}
			})

			if (!existingFavorite) {
				throw new NotFoundException('Event not found in favorites')
			}

			// Удаляем из избранного
			await this.prisma.user.update({
				where: { id: userId },
				data: {
					favorites: {
						disconnect: { id: eventId }
					}
				}
			})

			return true
		} catch (error) {
			console.error('Error removing from favorites:', error)
			throw error
		}
	}

	async getFavoriteEvents(userId: string): Promise<any> {
		console.log(
			`[${new Date().toISOString()}] [getFavoriteEvents] Начало выполнения для пользователя ${userId}`
		)

		try {
			// 1. Проверка существования пользователя
			console.log(
				`[${new Date().toISOString()}] [getFavoriteEvents] Проверяем существование пользователя ${userId}`
			)
			const userExists = await this.prisma.user.findUnique({
				where: { id: userId },
				select: { id: true }
			})

			if (!userExists) {
				console.error(
					`[${new Date().toISOString()}] [getFavoriteEvents] Пользователь ${userId} не найден!`
				)
				throw new NotFoundException(`User with id ${userId} not found`)
			}
			console.log(
				`[${new Date().toISOString()}] [getFavoriteEvents] Пользователь ${userId} существует`
			)

			// 2. Получаем список избранных событий
			console.log(
				`[${new Date().toISOString()}] [getFavoriteEvents] Получаем избранные события пользователя ${userId}`
			)
			const userWithFavorites = await this.prisma.user.findUnique({
				where: { id: userId },
				include: {
					favorites: {
						select: {
							id: true,
							title: true,
							startTime: true
						}
					}
				}
			})

			const favoritesCount = userWithFavorites?.favorites.length
			console.log(
				`[${new Date().toISOString()}] [getFavoriteEvents] Найдено ${favoritesCount} избранных событий`
			)

			if (favoritesCount === 0) {
				console.log(
					`[${new Date().toISOString()}] [getFavoriteEvents] Нет избранных событий, возвращаем пустой массив`
				)
				return []
			}

			// 3. Формируем список ID избранных событий
			const favoriteIds = userWithFavorites?.favorites.map(f => f.id)
			console.log(
				`[${new Date().toISOString()}] [getFavoriteEvents] ID избранных событий: ${favoriteIds?.join(', ')}`
			)

			// 4. Определяем тип для результата запроса
			type RawEventResult = {
				id: string
				title: string
				description: string
				startTime: Date
				endTime: Date | null
				photoUrls: string[]
				eventType: EventType
				eventProperties: EventProperty[]
				paymentType: PaymentType
				price: number | null
				currency: string | null
				postedDate: Date
				isVerified: boolean
				isPrivate: boolean
				maxParticipants: number | null
				tags: string[]
				status: EventStatus
				ageRestriction: number | null
				createdAt: Date
				updatedAt: Date
				locationId: string
				address: string | null
				city: string
				placeName: string | null
				longitude: number
				latitude: number
				organizerId: string
				username: string
				displayName: string
				avatar: string | null
				participants: Array<{
					id: string
					username: string
					displayName: string
					avatar: string | null
				}> | null
			}

			// 5. Выполняем основной запрос
			console.log(
				`[${new Date().toISOString()}] [getFavoriteEvents] Выполняем запрос к базе данных...`
			)
			const rawEvents = await this.prisma.$queryRaw<RawEventResult[]>`
			SELECT 
			  e.id,
			  e.title,
			  e.description,
			  e.start_time as "startTime",
			  e.end_time as "endTime",
			  e.photo_urls as "photoUrls",
			  e."eventType",
			  e."eventProperties",
			  e."paymentType",
			  e.price,
			  e.currency,
			  e.posted_date as "postedDate",
			  e.is_verified as "isVerified",
			  e.is_private as "isPrivate",
			  e.max_participants as "maxParticipants",
			  e.tags,
			  e.status,
			  e.age_restriction as "ageRestriction",
			  e.created_at as "createdAt",
			  e.updated_at as "updatedAt",
			  l.id as "locationId",
			  l.address,
			  l.city,
			  l.place_name as "placeName",
			  ST_X(l.coordinates::geometry) as longitude,
			  ST_Y(l.coordinates::geometry) as latitude,
			  u.id as "organizerId",
			  u.username,
			  u.display_name as "displayName",
			  u.avatar,
			  COALESCE((
				SELECT json_agg(json_build_object(
				  'id', p.id,
				  'username', p.username,
				  'displayName', p.display_name,
				  'avatar', p.avatar
				))
				FROM "_EventParticipants" ep
				JOIN "users" p ON ep."B" = p.id
				WHERE ep."A" = e.id
			  ), '[]'::json) as participants
			FROM "events" e
			INNER JOIN "locations" l ON e."locationId" = l.id
			INNER JOIN "users" u ON e."organizerId" = u.id
			WHERE e.id IN (${favoriteIds?.join("','")})
			ORDER BY e.start_time ASC
		  `
			console.log(
				`[${new Date().toISOString()}] [getFavoriteEvents] Получено ${rawEvents.length} событий из базы`
			)

			// 6. Преобразуем данные в нужный формат
			console.log(
				`[${new Date().toISOString()}] [getFavoriteEvents] Начинаем преобразование данных...`
			)
			const resultEvents = rawEvents.map((event, index) => {
				console.log(
					`[${new Date().toISOString()}] [getFavoriteEvents] Обрабатываем событие ${index + 1}/${rawEvents.length} (ID: ${event.id})`
				)

				// Валидация обязательных полей
				if (!event.startTime) {
					console.error(
						`[${new Date().toISOString()}] [getFavoriteEvents] Ошибка: событие ${event.id} не имеет startTime!`
					)
					throw new Error(`Event ${event.id} has no startTime`)
				}

				if (!event.locationId) {
					console.error(
						`[${new Date().toISOString()}] [getFavoriteEvents] Ошибка: событие ${event.id} не имеет locationId!`
					)
					throw new Error(`Event ${event.id} has no locationId`)
				}

				const result = {
					id: event.id,
					title: event.title,
					description: event.description,
					startTime: event.startTime,
					endTime: event.endTime,
					photoUrls: event.photoUrls,
					eventType: event.eventType,
					eventProperties: event.eventProperties,
					paymentType: event.paymentType,
					price: event.price,
					currency: event.currency,
					postedDate: event.postedDate,
					isVerified: event.isVerified,
					isPrivate: event.isPrivate,
					maxParticipants: event.maxParticipants,
					tags: event.tags,
					status: event.status,
					ageRestriction: event.ageRestriction,
					createdAt: event.createdAt,
					updatedAt: event.updatedAt,
					location: {
						id: event.locationId,
						address: event.address,
						city: event.city,
						placeName: event.placeName,
						coordinates: {
							longitude: event.longitude,
							latitude: event.latitude
						}
					},
					organizer: {
						id: event.organizerId,
						username: event.username,
						displayName: event.displayName,
						avatar: event.avatar
					},
					participants: event.participants || []
				}

				console.log(
					`[${new Date().toISOString()}] [getFavoriteEvents] Событие ${event.id} успешно обработано`
				)
				return result
			})

			console.log(
				`[${new Date().toISOString()}] [getFavoriteEvents] Все события успешно обработаны`
			)
			console.log(
				`[${new Date().toISOString()}] [getFavoriteEvents] Возвращаем ${resultEvents.length} событий`
			)

			return resultEvents
		} catch (error) {
			console.error(
				`[${new Date().toISOString()}] [getFavoriteEvents] КРИТИЧЕСКАЯ ОШИБКА:`,
				{
					error: error.message,
					stack: error.stack,
					userId
				}
			)
			throw new Error('Не удалось получить избранные события')
		}
	}
}
