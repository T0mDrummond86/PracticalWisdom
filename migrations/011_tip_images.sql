-- An AI-generated illustration per tip. Stores just the filename (e.g. "42.webp");
-- the files live in static/tip_images/ and ship with the repo, so a deploy carries
-- them. Empty string = no picture yet, and every view simply omits the image.
ALTER TABLE tips ADD COLUMN image_file TEXT NOT NULL DEFAULT '';
