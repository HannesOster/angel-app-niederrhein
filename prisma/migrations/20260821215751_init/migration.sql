-- CreateEnum
CREATE TYPE "GewaesserTyp" AS ENUM ('RHEIN', 'ALTRHEIN', 'BAGGERSEE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwortHash" TEXT NOT NULL,
    "erstelltAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gewaesser" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "typ" "GewaesserTyp" NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "referenzPegel" TEXT NOT NULL,
    "verzoegerungTage" INTEGER NOT NULL DEFAULT 0,
    "daempfung" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "abgeleitet" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Gewaesser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verein" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Verein_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GewaesserVerein" (
    "gewaesserId" TEXT NOT NULL,
    "vereinId" TEXT NOT NULL,

    CONSTRAINT "GewaesserVerein_pkey" PRIMARY KEY ("gewaesserId","vereinId")
);

-- CreateTable
CREATE TABLE "Mitgliedschaft" (
    "userId" TEXT NOT NULL,
    "vereinId" TEXT NOT NULL,

    CONSTRAINT "Mitgliedschaft_pkey" PRIMARY KEY ("userId","vereinId")
);

-- CreateTable
CREATE TABLE "Tageskarte" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gewaesserId" TEXT NOT NULL,
    "von" TIMESTAMP(3) NOT NULL,
    "bis" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tageskarte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PegelMessung" (
    "id" TEXT NOT NULL,
    "station" TEXT NOT NULL,
    "zeit" TIMESTAMP(3) NOT NULL,
    "wasserstandCm" INTEGER NOT NULL,
    "wassertemperaturC" DOUBLE PRECISION,

    CONSTRAINT "PegelMessung_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WetterStunde" (
    "id" TEXT NOT NULL,
    "gewaesserId" TEXT NOT NULL,
    "zeit" TIMESTAMP(3) NOT NULL,
    "luftdruckHpa" DOUBLE PRECISION NOT NULL,
    "bewoelkung" DOUBLE PRECISION NOT NULL,
    "windKmh" DOUBLE PRECISION NOT NULL,
    "lufttemperaturC" DOUBLE PRECISION NOT NULL,
    "niederschlagMm" DOUBLE PRECISION NOT NULL,
    "sonnenaufgang" TIMESTAMP(3) NOT NULL,
    "sonnenuntergang" TIMESTAMP(3) NOT NULL,
    "abgerufenAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WetterStunde_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GewichtsProfil" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fisch" TEXT NOT NULL,
    "gewichte" JSONB NOT NULL,

    CONSTRAINT "GewichtsProfil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fang" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gewaesserId" TEXT NOT NULL,
    "zeit" TIMESTAMP(3) NOT NULL,
    "fischart" TEXT NOT NULL,
    "laengeCm" INTEGER,
    "koeder" TEXT,
    "notiz" TEXT,
    "schnappschuss" JSONB NOT NULL,

    CONSTRAINT "Fang_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Gewaesser_slug_key" ON "Gewaesser"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Verein_slug_key" ON "Verein"("slug");

-- CreateIndex
CREATE INDEX "Tageskarte_userId_bis_idx" ON "Tageskarte"("userId", "bis");

-- CreateIndex
CREATE INDEX "PegelMessung_station_zeit_idx" ON "PegelMessung"("station", "zeit");

-- CreateIndex
CREATE UNIQUE INDEX "PegelMessung_station_zeit_key" ON "PegelMessung"("station", "zeit");

-- CreateIndex
CREATE INDEX "WetterStunde_gewaesserId_zeit_idx" ON "WetterStunde"("gewaesserId", "zeit");

-- CreateIndex
CREATE UNIQUE INDEX "WetterStunde_gewaesserId_zeit_key" ON "WetterStunde"("gewaesserId", "zeit");

-- CreateIndex
CREATE UNIQUE INDEX "GewichtsProfil_userId_fisch_key" ON "GewichtsProfil"("userId", "fisch");

-- CreateIndex
CREATE INDEX "Fang_userId_zeit_idx" ON "Fang"("userId", "zeit");

-- AddForeignKey
ALTER TABLE "GewaesserVerein" ADD CONSTRAINT "GewaesserVerein_gewaesserId_fkey" FOREIGN KEY ("gewaesserId") REFERENCES "Gewaesser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GewaesserVerein" ADD CONSTRAINT "GewaesserVerein_vereinId_fkey" FOREIGN KEY ("vereinId") REFERENCES "Verein"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mitgliedschaft" ADD CONSTRAINT "Mitgliedschaft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mitgliedschaft" ADD CONSTRAINT "Mitgliedschaft_vereinId_fkey" FOREIGN KEY ("vereinId") REFERENCES "Verein"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tageskarte" ADD CONSTRAINT "Tageskarte_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tageskarte" ADD CONSTRAINT "Tageskarte_gewaesserId_fkey" FOREIGN KEY ("gewaesserId") REFERENCES "Gewaesser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WetterStunde" ADD CONSTRAINT "WetterStunde_gewaesserId_fkey" FOREIGN KEY ("gewaesserId") REFERENCES "Gewaesser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GewichtsProfil" ADD CONSTRAINT "GewichtsProfil_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fang" ADD CONSTRAINT "Fang_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fang" ADD CONSTRAINT "Fang_gewaesserId_fkey" FOREIGN KEY ("gewaesserId") REFERENCES "Gewaesser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
