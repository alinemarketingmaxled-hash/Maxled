-- A empresa pode vender com estoque negativo (padrão da MAX LED).
ALTER TABLE "Company" ADD COLUMN "allowNegativeStock" BOOLEAN NOT NULL DEFAULT true;
