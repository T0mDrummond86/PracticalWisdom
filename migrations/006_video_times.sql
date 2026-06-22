-- Optional start/stop times (whole seconds) for a tip's video. 0 = unset: start plays from
-- the beginning, end plays to the end. YouTube honours both; Vimeo / Cloudflare Stream honour
-- the start time only (a hard stop on those would need their JS player SDK).
ALTER TABLE tips ADD COLUMN video_start INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tips ADD COLUMN video_end INTEGER NOT NULL DEFAULT 0;
