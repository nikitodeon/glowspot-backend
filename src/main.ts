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

	// Парсинг cookies
	app.use(cookieParser(config.getOrThrow<string>('COOKIES_SECRET')))

	// Использование graphql upload
	app.use(config.getOrThrow<string>('GRAPHQL_PREFIX'), graphqlUploadExpress())

	// Валидация глобальная
	app.useGlobalPipes(
		new ValidationPipe({
			transform: true
		})
	)

	// Сессии с явным контролем куки
	app.use(
		session({
			secret: config.getOrThrow<string>('SESSION_SECRET'),
			name: config.getOrThrow<string>('SESSION_NAME'),
			resave: false,
			saveUninitialized: false,
			cookie: {
				// domain: config.getOrThrow<string>('SESSION_DOMAIN'),
				// Так как SameSite=None необходимо для работы кросс-доменных cookies
				maxAge: ms(config.getOrThrow<StringValue>('SESSION_MAX_AGE')),
				httpOnly: parseBoolean(
					config.getOrThrow<string>('SESSION_HTTP_ONLY')
				),
				secure: parseBoolean(
					config.getOrThrow<string>('SESSION_SECURE')
				),
				sameSite: 'none' // НЕ ЗАБУДЬ: это нужно для кросс-доменных cookies
			},
			store: new RedisStore({
				client: redis,
				prefix: config.getOrThrow<string>('SESSION_FOLDER')
			})
		})
	)

	// Промежуточное ПО для принудительного добавления cookies в response
	app.use((req, res, next) => {
		if (req.session && req.session.cookie) {
			// Принудительно добавляем cookie в ответ
			res.cookie(req.session.cookie.name, req.sessionID, {
				httpOnly: true, // защищаем cookie
				secure: req.protocol === 'https', // Если это https - выставляем secure=true
				sameSite: 'None', // Без этого cookies не будут работать на разных доменах
				maxAge: ms(config.getOrThrow<StringValue>('SESSION_MAX_AGE')) // Время жизни cookies
			})
		}
		next()
	})

	// Принудительное включение CORS
	app.enableCors({
		origin: config.getOrThrow<string>('ALLOWED_ORIGIN'),
		credentials: true, // Обязательно включаем
		methods: ['GET', 'POST', 'OPTIONS'], // Разрешаем необходимые методы
		allowedHeaders: [
			'DNT',
			'User-Agent',
			'X-Requested-With',
			'If-Modified-Since',
			'Cache-Control',
			'Content-Type',
			'Authorization',
			'apollo-require-preflight',
			'Set-Cookie' // Это очень важно! Мы должны разрешить Set-Cookie в заголовках
		],
		exposedHeaders: ['set-cookie'] // Обязательно expose set-cookie, чтобы было доступно на клиенте
	})

	// Запуск приложения на порту
	await app.listen(config.getOrThrow<number>('APPLICATION_PORT'))
}
bootstrap()
