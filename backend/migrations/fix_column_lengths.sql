-- Fix column length issues for medicines table
-- Some strength and unit values are longer than 200 characters (complex combinations)

-- Change strength to TEXT (unlimited length) to handle very complex medicine combinations
ALTER TABLE medicines 
ALTER COLUMN strength TYPE TEXT;

-- Change unit to TEXT as well for safety
ALTER TABLE medicines 
ALTER COLUMN unit TYPE TEXT;

-- Also ensure MRID can handle longer values if needed
ALTER TABLE medicines 
ALTER COLUMN mrid TYPE VARCHAR(100);

ALTER TABLE medicine_brands 
ALTER COLUMN mrid TYPE VARCHAR(100);

ALTER TABLE medicine_codes 
ALTER COLUMN mrid TYPE VARCHAR(100);

SELECT 'Column lengths updated successfully!' as status;

