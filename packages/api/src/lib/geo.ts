import { sql, type SQL } from "drizzle-orm";
import { listings } from "@cardtrade/db";

/**
 * Distance haversine en km entre un point et une annonce, en SQL pur.
 * Suffisant pour la Phase 1 ; à remplacer par PostGIS (`<->` sur geography)
 * quand le volume d'annonces le justifiera.
 */
export function distanceKmSql(latitude: number, longitude: number): SQL<number> {
  return sql<number>`(
    6371 * acos(
      least(1.0,
        cos(radians(${latitude})) * cos(radians(${listings.latitude}))
        * cos(radians(${listings.longitude}) - radians(${longitude}))
        + sin(radians(${latitude})) * sin(radians(${listings.latitude}))
      )
    )
  )`;
}
