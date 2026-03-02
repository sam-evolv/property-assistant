-- Add access_code to installations
-- Short, human-readable code for homeowner access (e.g. HEATPUMP01, SOLAR-CORK)
ALTER TABLE installations
  ADD COLUMN IF NOT EXISTS access_code TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_installations_access_code ON installations(access_code);

-- Seed demo access codes for existing installations (by serial number)
UPDATE installations SET access_code = 'SOLAR01'     WHERE serial_number = 'SE7E234567A';
UPDATE installations SET access_code = 'SOLAR02'     WHERE serial_number = 'FRO123456789';
UPDATE installations SET access_code = 'SOLAR03'     WHERE serial_number = 'SE7E987654B';
UPDATE installations SET access_code = 'HEATPUMP01'  WHERE serial_number = 'NIBE123456789';
UPDATE installations SET access_code = 'HEATPUMP02'  WHERE serial_number = 'SAM123ABC456';
UPDATE installations SET access_code = 'EVCHARGER01' WHERE serial_number = 'ZAP123456789';
