/**
 * Projections de profil PUBLIQUES pour les `with:` Drizzle.
 * JAMAIS d'email, de coordonnées GPS exactes ni de stripeAccountId dans une
 * réponse API — constats critiques n°1/3/4 de l'audit 2026-07.
 */
export const publicProfileColumns = {
  columns: {
    userId: true,
    username: true,
    avatarUrl: true,
    city: true,
    countryCode: true,
    ratingAvg: true,
    tradeCount: true,
    createdAt: true,
  },
} as const;

/** Utilisateur joint sans email, avec profil public uniquement. */
export const publicUserWith = {
  columns: { id: true },
  with: { profile: publicProfileColumns },
} as const;
