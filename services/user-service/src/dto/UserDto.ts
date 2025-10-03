import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEmail,
  IsUrl,
  IsDateString,
  IsIn,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString({ message: 'First name must be a string' })
  @MaxLength(100, { message: 'First name must not exceed 100 characters' })
  first_name?: string;

  @IsOptional()
  @IsString({ message: 'Last name must be a string' })
  @MaxLength(100, { message: 'Last name must not exceed 100 characters' })
  last_name?: string;

  @IsOptional()
  @IsString({ message: 'Bio must be a string' })
  @MaxLength(500, { message: 'Bio must not exceed 500 characters' })
  bio?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Avatar URL must be a valid URL' })
  @MaxLength(500, { message: 'Avatar URL must not exceed 500 characters' })
  avatar_url?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Cover URL must be a valid URL' })
  @MaxLength(500, { message: 'Cover URL must not exceed 500 characters' })
  cover_url?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Date of birth must be a valid date' })
  date_of_birth?: string;

  @IsOptional()
  @IsString({ message: 'Location must be a string' })
  @MaxLength(255, { message: 'Location must not exceed 255 characters' })
  location?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Website must be a valid URL' })
  @MaxLength(255, { message: 'Website must not exceed 255 characters' })
  website?: string;

  @IsOptional()
  @IsString({ message: 'Phone must be a string' })
  @MaxLength(20, { message: 'Phone must not exceed 20 characters' })
  phone?: string;

  @IsOptional()
  @IsBoolean({ message: 'Is public must be a boolean' })
  is_public?: boolean;
}

export class UpdatePrivacyDto {
  @IsOptional()
  @IsIn(['public', 'friends', 'private'], {
    message: 'Profile visibility must be public, friends, or private',
  })
  profile_visibility?: 'public' | 'friends' | 'private';

  @IsOptional()
  @IsIn(['public', 'friends', 'private'], {
    message: 'Email visibility must be public, friends, or private',
  })
  email_visibility?: 'public' | 'friends' | 'private';

  @IsOptional()
  @IsIn(['public', 'friends', 'private'], {
    message: 'Phone visibility must be public, friends, or private',
  })
  phone_visibility?: 'public' | 'friends' | 'private';

  @IsOptional()
  @IsIn(['public', 'friends', 'private'], {
    message: 'Location visibility must be public, friends, or private',
  })
  location_visibility?: 'public' | 'friends' | 'private';

  @IsOptional()
  @IsIn(['public', 'friends', 'private'], {
    message: 'Friend list visibility must be public, friends, or private',
  })
  friend_list_visibility?: 'public' | 'friends' | 'private';

  @IsOptional()
  @IsIn(['public', 'friends', 'private'], {
    message: 'Post visibility default must be public, friends, or private',
  })
  post_visibility_default?: 'public' | 'friends' | 'private';

  @IsOptional()
  @IsBoolean({ message: 'Allow friend requests must be a boolean' })
  allow_friend_requests?: boolean;

  @IsOptional()
  @IsIn(['everyone', 'friends', 'none'], {
    message: 'Allow messages must be everyone, friends, or none',
  })
  allow_messages?: 'everyone' | 'friends' | 'none';

  @IsOptional()
  @IsBoolean({ message: 'Allow tagging must be a boolean' })
  allow_tagging?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'Allow sharing must be a boolean' })
  allow_sharing?: boolean;
}

export class SendFriendRequestDto {
  @IsUUID('4', { message: 'Addressee ID must be a valid UUID' })
  addressee_id!: string;

  @IsOptional()
  @IsString({ message: 'Message must be a string' })
  @MaxLength(500, { message: 'Message must not exceed 500 characters' })
  message?: string;
}

export class RespondFriendRequestDto {
  @IsUUID('4', { message: 'Request ID must be a valid UUID' })
  request_id!: string;

  @IsIn(['accept', 'decline'], { message: 'Action must be accept or decline' })
  action!: 'accept' | 'decline';
}

export class UserSearchDto {
  @IsString({ message: 'Query must be a string' })
  @MinLength(1, { message: 'Query must be at least 1 character long' })
  @MaxLength(100, { message: 'Query must not exceed 100 characters' })
  query!: string;

  @IsOptional()
  limit?: number;

  @IsOptional()
  offset?: number;
}

export class GetUserDto {
  @IsUUID('4', { message: 'User ID must be a valid UUID' })
  id!: string;
}
