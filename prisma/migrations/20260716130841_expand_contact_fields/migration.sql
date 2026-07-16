-- CreateEnum
CREATE TYPE "PersonType" AS ENUM ('FISICA', 'JURIDICA');

-- CreateEnum
CREATE TYPE "CommercialPotential" AS ENUM ('ALTO', 'MEDIO', 'BAIXO');

-- CreateEnum
CREATE TYPE "CrmStatus" AS ENUM ('LEAD', 'ATIVO', 'INATIVO');

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "birthday" TIMESTAMP(3),
ADD COLUMN     "commercialPotential" "CommercialPotential",
ADD COLUMN     "crmStatus" "CrmStatus",
ADD COLUMN     "nextContactAt" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "personType" "PersonType";
