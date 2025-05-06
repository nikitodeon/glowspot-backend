import { Field, InputType } from '@nestjs/graphql'
import {
	IsNotEmpty,
	IsOptional,
	IsString,
	Matches,
	MaxLength
} from 'class-validator'

@InputType()
export class ChangeProfileInfoInput {
	@Field(() => String)
	@IsString()
	@IsNotEmpty()
	@Matches(/^[a-zA-Zа-яА-ЯёЁ0-9]+(?:-[a-zA-Zа-яА-ЯёЁ0-9]+)*$/, {
		message:
			'Имя пользователя может содержать буквы (в т.ч. русские), цифры и дефисы'
	})
	public username: string

	@Field(() => String)
	@IsString()
	@IsNotEmpty()
	public displayName: string

	@Field(() => String)
	@IsString()
	@IsOptional()
	@MaxLength(300)
	public bio?: string
}
