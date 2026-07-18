import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@cardtrade/i18n";
import { Card, Muted, Screen, SectionTitle } from "../../src/components/ui";
import { ChipRow } from "../../src/components/forms";
import { Sparkline } from "../../src/components/Sparkline";
import { trpc } from "../../src/lib/trpc";
import { colors, radius, spacing } from "../../src/theme";

const RANGES = ["7d", "1m", "3m", "6m", "max"] as const;
type Range = (typeof RANGES)[number];

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cardId = Number(id);
  const { t, i18n } = useTranslation();
  const [range, setRange] = useState<Range>("1m");

  const card = trpc.catalog.cardById.useQuery({ cardId }, { enabled: cardId > 0 });
  const prices = trpc.prices.history.useQuery(
    { cardId, range },
    { enabled: cardId > 0, retry: false },
  );
  const sellers = trpc.listings.search.useQuery(
    { cardId, radiusKm: 100, cursor: 0, limit: 5 },
    { enabled: cardId > 0 },
  );

  const eu = prices.data?.eu ?? [];
  const us = prices.data?.us ?? [];
  const lastEu = eu[eu.length - 1];
  const lastUs = us[us.length - 1];
  // Écart brut EU/US (devises différentes — indicatif, conversion Phase 3).
  const gap =
    lastEu && lastUs
      ? ((lastUs.price_cents - lastEu.price_cents) / lastEu.price_cents) * 100
      : null;
  const proLocked = prices.data?.usLocked ?? false;

  return (
    <Screen>
      <Text style={styles.title}>{card.data?.name ?? "…"}</Text>
      {card.data && (
        <Muted>
          {card.data.set.game.name} · {card.data.set.name} · {card.data.number}
          {card.data.rarity ? ` · ${card.data.rarity}` : ""}
        </Muted>
      )}
      {card.data?.imageUrl && (
        <Image source={{ uri: card.data.imageUrl }} style={styles.cardImage} />
      )}

      <Card>
        <View style={styles.priceRow}>
          <View style={styles.priceCol}>
            <Muted>{t("card.euPrice")}</Muted>
            <Text style={styles.price}>
              {lastEu
                ? formatCurrency(lastEu.price_cents, "EUR", i18n.language)
                : "—"}
            </Text>
          </View>
          <View style={styles.priceCol}>
            <Muted>{t("card.usPrice")}</Muted>
            <Text style={styles.price}>
              {lastUs
                ? formatCurrency(lastUs.price_cents, "USD", i18n.language)
                : proLocked
                  ? "🔒"
                  : "—"}
            </Text>
          </View>
        </View>
        {gap != null && (
          <Text style={styles.gap}>{t("card.gap", { gap: gap.toFixed(1) })}</Text>
        )}
        {proLocked && (
          <Link href="/paywall" asChild>
            <Pressable>
              <Text style={styles.proLink}>{t("card.proLocked")} →</Text>
            </Pressable>
          </Link>
        )}

        <Sparkline points={eu.map((p) => p.price_cents)} height={120} />
        <ChipRow
          options={RANGES.map((value) => ({ value, label: value.toUpperCase() }))}
          value={range}
          onChange={(value) => setRange(value as Range)}
        />
        {prices.isError && prices.error.message.startsWith("PRO_REQUIRED") && (
          <Link href="/paywall" asChild>
            <Pressable>
              <Text style={styles.proLink}>{t("paywall.unlockPro")} →</Text>
            </Pressable>
          </Link>
        )}
      </Card>

      <SectionTitle>{t("card.sellersNearby")}</SectionTitle>
      {sellers.data?.items.length === 0 && <Muted>{t("card.noSellers")}</Muted>}
      {sellers.data?.items.map(({ listing, distanceKm }) => (
        <Link key={listing.id} href={`/listing/${listing.id}`} asChild>
          <Pressable>
            <Card>
              <Text style={styles.sellerLine}>
                {t(`listing.${listing.type}`)}
                {listing.condition
                  ? ` · ${t(`listing.condition.${listing.condition}`)}`
                  : ""}
                {listing.priceCents != null
                  ? ` · ${formatCurrency(listing.priceCents, listing.currency, i18n.language)}`
                  : ""}
              </Text>
              <Muted>
                {listing.city ?? "—"}
                {distanceKm > 0
                  ? ` · ${t("home.distanceAway", { distance: distanceKm.toFixed(1) })}`
                  : ""}
              </Muted>
            </Card>
          </Pressable>
        </Link>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 24, fontWeight: "800" },
  cardImage: {
    width: 180,
    height: 250,
    borderRadius: radius.md,
    alignSelf: "center",
  },
  priceRow: { flexDirection: "row", gap: spacing.lg },
  priceCol: { flex: 1, gap: 2 },
  price: { color: colors.text, fontSize: 24, fontWeight: "800" },
  gap: { color: colors.gold, fontSize: 15, fontWeight: "700" },
  proLink: { color: colors.gold, fontSize: 14, fontWeight: "600" },
  sellerLine: { color: colors.text, fontSize: 15, fontWeight: "600" },
});
