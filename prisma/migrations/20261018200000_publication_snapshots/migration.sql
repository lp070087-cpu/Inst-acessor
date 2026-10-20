-- Additive snapshot: editing a draft must never change an already queued post.
ALTER TABLE "PublishQueue" ADD COLUMN "payloadSnapshot" JSONB;
