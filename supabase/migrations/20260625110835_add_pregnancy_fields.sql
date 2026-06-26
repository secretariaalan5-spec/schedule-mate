ALTER TABLE public.patients
ADD COLUMN is_pregnant BOOLEAN DEFAULT false,
ADD COLUMN dum DATE,
ADD COLUMN risk_classification TEXT CHECK (risk_classification IN ('BAIXO', 'ALTO')),
ADD COLUMN gestational_notes TEXT;
