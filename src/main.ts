import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { RedisStore } from 'connect-redis'
import * as cookieParser from 'cookie-parser'
import * as session from 'express-session'
import * as graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.js'

import { CoreModule } from './core/core.module'
import { RedisService } from './core/redis/redis.service'
import { ms, type StringValue } from './shared/utils/ms.util'
import { parseBoolean } from './shared/utils/parse-boolean.util'

async function bootstrap() {
	const app = await NestFactory.create(CoreModule, { rawBody: true })

	const config = app.get(ConfigService)
	const redis = app.get(RedisService)

	// Установим правильные заголовки для CORS
	app.use((req, res, next) => {
		const origin = config.getOrThrow<string>('ALLOWED_ORIGIN') // получаем разрешенный origin
		const allowedOrigins = ['https://glowspot.ru', origin] // нужные origins

		// Проверим, что origin запроса совпадает с разрешенным
		if (allowedOrigins.includes(req.headers.origin || '')) {
			res.setHeader(
				'Access-Control-Allow-Origin',
				req.headers.origin || '*'
			)
			res.setHeader('Access-Control-Allow-Credentials', 'true')
		}

		// Эти заголовки для preflight-запросов (OPTIONS)
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
		res.setHeader(
			'Access-Control-Allow-Headers',
			'Content-Type, Authorization, X-Requested-With'
		)

		if (req.method === 'OPTIONS') {
			return res.status(204).end()
		}

		next()
	})

	app.use(cookieParser(config.getOrThrow<string>('COOKIES_SECRET')))
	app.use(config.getOrThrow<string>('GRAPHQL_PREFIX'), graphqlUploadExpress())

	app.useGlobalPipes(
		new ValidationPipe({
			transform: true
		})
	)

	app.use(
		session({
			secret: config.getOrThrow<string>('SESSION_SECRET'),
			name: config.getOrThrow<string>('SESSION_NAME'),
			resave: false,
			saveUninitialized: false,
			cookie: {
				domain: config.getOrThrow<string>('SESSION_DOMAIN'),
				maxAge: ms(config.getOrThrow<StringValue>('SESSION_MAX_AGE')),
				httpOnly: parseBoolean(
					config.getOrThrow<string>('SESSION_HTTP_ONLY')
				),
				secure: parseBoolean(
					config.getOrThrow<string>('SESSION_SECURE')
				),
				sameSite: 'lax'
			},
			store: new RedisStore({
				client: redis,
				prefix: config.getOrThrow<string>('SESSION_FOLDER')
			})
		})
	)

	// Настройка CORS через метод `enableCors`
	app.enableCors({
		origin: config.getOrThrow<string>('ALLOWED_ORIGIN'),
		credentials: true,
		exposedHeaders: ['set-cookie']
	})

	await app.listen(config.getOrThrow<number>('APPLICATION_PORT'))
}
bootstrap()
