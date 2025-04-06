/*
  Warnings:

  - The values [WORKSHOP] on the enum `event_types` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "event_types_new" AS ENUM ('EXHIBITION', 'MEETUP', 'WALK', 'PARTY', 'CONCERT', 'SPORT', 'FESTIVAL', 'LECTURE', 'OTHER', 'MOVIE', 'THEATRE', 'STANDUP', 'DANCE', 'BOOK_CLUB', 'KARAOKE', 'CYBERSPORT', 'KIDS_EVENT');
ALTER TABLE "events" ALTER COLUMN "eventType" TYPE "event_types_new" USING ("eventType"::text::"event_types_new");
ALTER TYPE "event_types" RENAME TO "event_types_old";
ALTER TYPE "event_types_new" RENAME TO "event_types";
DROP TYPE "event_types_old";
COMMIT;
