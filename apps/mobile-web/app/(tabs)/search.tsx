import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput } from "react-native";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@cardtrade/i18n";
import type { ListingType } from "@cardtrade/validators";
import { Card, Muted, Screen } from "../../src/components/ui";
import { ChipRow } from "../../src/components/forms";
import { trpc } from "../../src/lib/trpc";
import { colors, radius, spacing } from "../../src/theme";

const RADII = [10, 25, 50, 100] as const;

export default function SearchScreen() {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<"cards" | "listings">("listings");
  const [query, setQuery] = useState("");
  const [radiusKm, setRadiusKm] = useState<number>(25);
  const [type, setType] = useState<ListingType | null>(null);

  const cards = trpc.catalog.searchCards.useQuery(
    { query, limit: 20 },
    { enabled: mode === "cards" && query.length >= 2 },
  );
  const listings = trpc.listings.search.useQuery(
    {
      query: query.length >= 2 ? query : undefined,
      radiusKm,
      type: type ?? undefined,
      cursor: 0,
      limit: 20,
    },
    { enabled: mode === "listings" },
  );

  return (
    <Screen>
      <ChipRow
        options={[
          { value: "listings", label: t("searchTabs.listings") },
          { value: "cards", label: t("searchTabs.cards") },
        ]}
        value={mode}
        onChange={(value) => setMode(value as "cards" | "listings")}
      />
      <TextInput
        style={styles.input}
        placeholder={t("search.placeholder")}
        placeholderTextColor={colors.textMuted}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
      />

      {mode === "listings" && (
        <>
          <Muted>{t("search.radius")}</Muted>
          <ChipRow
            options={RADII.map((r) => ({ value: String(r), label: `${r} km` }))}
            value={String(radiusKm)}
            onChange={(value) => setRadiusKm(Number(value))}
          />
          <ChipRow
            options={(["sale", "trade", "wanted"] as const).map((value) => ({
              value,
              label: t(`listing.${value}`),
            }))}
            value={type}
            onChange={(value) =>
              setType((previous) => (previous === value ? null : (value as ListingType)))
            }
          />
          {listings.isFetching && <Muted>{t("common.loading")}</Muted>}
          {listings.data?.items.length === 0 && <Muted>{t("search.noResults")}</Muted>}
          {listings.data?.items.map(({ listing, distanceKm }) => (
            <Link key={listing.id} href={`/listing/${listing.id}`} asChild>
              <Pressable>
                <Card>
                  <Text style={styles.cardName}>
                    {t(`listing.${listing.type}`)}
                    {listing.condition
                      ? ` · ${t(`listing.condition.${listing.condition}`)}`
                      : ""}
                    {listing.cardLanguage ? ` · ${listing.cardLanguage.toUpperCase()}` : ""}
                  </Text>
                  <Muted>
                    {listing.city ?? "—"}
                    {distanceKm > 0
                      ? ` · ${t("home.distanceAway", { distance: distanceKm.toFixed(1) })}`
                      : ""}
                  </Muted>
                  {listing.priceCents != null && (
                    <Text style={styles.price}>
                      {formatCurrency(listing.priceCents, listing.currency, i18n.language)}
                    </Text>
                  )}
                </Card>
              </Pressable>
            </Link>
          ))}
        </>
      )}

      {mode === "cards" && (
        <>
          {cards.isFetching && <Muted>{t("common.loading")}</Muted>}
          {cards.data?.map((card) => (
            <Card key={card.id}>
              <Text style={styles.cardName}>{card.name}</Text>
              <Muted>
                {card.set.game.name} · {card.set.name} · {card.number}
              </Muted>
            </Card>
          ))}
          {query.length >= 2 && cards.data?.length === 0 && (
            <Muted>{t("search.noResults")}</Muted>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: radius.full,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
  },
  cardName: { color: colors.text, fontSize: 16, fontWeight: "600" },
  price: { color: colors.accent, fontSize: 18, fontWeight: "700" },
});
