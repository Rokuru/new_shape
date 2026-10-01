import { defineConfig } from 'vitest/config';

// Fuseau fixé pour que les tests de dates soient reproductibles (et couvrent l'heure d'été / d'hiver).
process.env.TZ = 'Europe/Paris';

export default defineConfig({ test: {} });
