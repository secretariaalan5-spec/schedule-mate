
-- Step 1: For each set of duplicates, pick the one with the most appointments (or oldest) as keeper
-- and reassign all appointments from duplicates to the keeper
DO $$
DECLARE
  rec RECORD;
  keeper_id UUID;
BEGIN
  FOR rec IN
    SELECT UPPER(name) as uname
    FROM patients
    GROUP BY UPPER(name)
    HAVING COUNT(*) > 1
  LOOP
    -- Pick keeper: most appointments, then oldest created_at
    SELECT p.id INTO keeper_id
    FROM patients p
    LEFT JOIN (SELECT patient_id, COUNT(*) as cnt FROM appointments GROUP BY patient_id) a ON a.patient_id = p.id
    WHERE UPPER(p.name) = rec.uname
    ORDER BY COALESCE(a.cnt, 0) DESC, p.created_at ASC
    LIMIT 1;

    -- Reassign appointments from duplicates to keeper
    UPDATE appointments SET patient_id = keeper_id
    WHERE patient_id IN (
      SELECT id FROM patients WHERE UPPER(name) = rec.uname AND id != keeper_id
    );

    -- Delete duplicates
    DELETE FROM patients WHERE UPPER(name) = rec.uname AND id != keeper_id;
  END LOOP;
END $$;

-- Step 2: Add unique index to prevent future duplicates
CREATE UNIQUE INDEX patients_name_unique ON patients (UPPER(name));
