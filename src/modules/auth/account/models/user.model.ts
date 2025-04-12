import { Field, ID, ObjectType } from '@nestjs/graphql'

import type { User } from '@/prisma/generated'
import { NotificationSettingsModel } from '@/src/modules/notification/models/notification-settings.model'
import { NotificationModel } from '@/src/modules/notification/models/notification.model'

import { SocialLinkModel } from '../../profile/models/social-link.model'

// import { EventModel } from '@/src/modules/event/models/event.model'

// import { PaymentModel } from '@/src/modules/payment/models/payment.model'
// import { EventReviewModel } from '@/src/modules/event/models/event-review.model'

@ObjectType()
export class UserModel implements User {
	@Field(() => ID)
	public id: string

	@Field(() => String)
	public email: string

	@Field(() => String)
	public password: string

	@Field(() => String)
	public username: string

	@Field(() => String)
	public displayName: string

	@Field(() => String, { nullable: true })
	public avatar: string

	@Field(() => String, { nullable: true })
	public bio: string

	@Field(() => String, { nullable: true })
	public telegramId: string

	@Field(() => Boolean)
	public isVerified: boolean

	@Field(() => Boolean)
	public isAdmin: boolean

	@Field(() => Boolean)
	public isEmailVerified: boolean

	@Field(() => Boolean)
	public isTotpEnabled: boolean

	@Field(() => String, { nullable: true })
	public totpSecret: string

	@Field(() => Boolean)
	public isDeactivated: boolean

	@Field(() => Date, { nullable: true })
	public deactivatedAt: Date

	@Field(() => Date, { nullable: true })
	public birthDate: Date // ✅ Добавили поле birthDate

	@Field(() => [SocialLinkModel], { nullable: true })
	public socialLinks: SocialLinkModel[]

	@Field(() => [NotificationModel], { nullable: true })
	public notifications: NotificationModel[]

	@Field(() => NotificationSettingsModel, { nullable: true })
	public notificationSettings: NotificationSettingsModel

	//   @Field(() => [EventModel], { nullable: true })
	//   public organizedEvents: EventModel[]  // ✅ Добавлено

	//   @Field(() => [EventModel], { nullable: true })
	//   public participatingIn: EventModel[]  // ✅ Добавлено

	//   @Field(() => [PaymentModel], { nullable: true })
	//   public payments: PaymentModel[]  // ✅ Добавлено

	//   @Field(() => [EventReviewModel], { nullable: true })
	//   public reviews: EventReviewModel[]  // ✅ Добавлено

	@Field(() => Date)
	public createdAt: Date

	@Field(() => Date)
	public updatedAt: Date
}
