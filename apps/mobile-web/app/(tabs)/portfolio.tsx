import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@cardtrade/i18n";
import { Card, Muted, PriceChange, Screen, SectionTitle } from "../../src/components/ui";
import { trpc } from "../../src/lib/trpc";
import { colors, radius, spacing } from "../../src/theme";

const RANGES = ["1d", "7d", "1m", "3m", "6m", "max"] as const;
type Range = (typeof RANGES)[number];

export default function PortfolioScreen() {
  const { t, i18n } = useTranslation();
  const [range, setRange] = useState<Range>("1m");
  const [market, setMarket] = useState<"eu" | "us">("eu");

  const history = trpc.collection.portfolioHistory.useQuery(
    { range, market },
    { retry: false },
  );
  const items = trpc.collection.list.useQuery(undefined, { retry: false });

  const points = history.data ?? [];
  const latest = points[points.length - 1]?.totalCents ?? 0;
  const first = points[0]?.totalCents ?? latest;
  const delta = latest - first;
  const currency = market === "eu" ? "EUR" : "USD";

  return (
    <Screen>
      <SectionTitle>{t("portfolio.title")}</SectionTitle>

      <Card style={styles.hero}>
        <Muted>{t("portfolio.totalValue")}</Muted>
        <Text style={styles.totalValue}>
          {formatCurrency(latest, currency, i18n.language)}
        </Text>
        <PriceChange cents={delta} percent={first ? (delta / first) * 100 : 0} />

        <View style={styles.rangeRow}>
          {RANGES.map((r) => (
            <Pressable
              key={r}
              onPress={() => setRange(r)}
              style={[styles.rangeChip, range === r && styles.rangeChipActive]}
            >
              <Text style={range === r ? styles.rangeTextActive : styles.rangeText}>
                {r.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.rangeRow}>
          <Pressable
            onPress={() => setMarket("eu")}
            style={[styles.rangeChip, market === "eu" && styles.rangeChipActive]}
          >
            <Text style={market === "eu" ? styles.rangeTextActive : styles.rangeText}>
              {t("portfolio.euMarket")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMarket("us")}
            style={[styles.rangeChip, market === "us" && styles.rangeChipActive]}
          >
            <Text style={market === "us" ? styles.rangeTextActive : styles.rangeText}>
              {t("portfolio.usMarket")}
            </Text>
          </Pressable>
        </View>
      </Card>

      <SectionTitle>{t("portfolio.mostValuable")}</SectionTitle>
      {items.isError && <Muted>{t("auth.signIn")}</Muted>}
      {items.data?.map((item) => (
        <Card key={item.id}>
          <Text style={styles.itemName}>
            {item.card?.name ?? item.sealedProduct?.name}
            {item.isFoil ? " · Foil" : ""}
          </Text>
          <Muted>
            {item.cardLanguage ? `${t("portfolio.cardLanguage")}: ${item.cardLanguage.toUpperCase()} · ` : ""}
            ×{item.quantity}
            {item.forTrade ? ` · ${t("portfolio.forTrade")}` : ""}
            {item.forSale ? ` · ${t("portfolio.forSale")}` : ""}
          </Muted>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.sm },
  totalValue: { color: colors.text, fontSize: 40, fontWeight: "800" },
  rangeRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  rangeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  rangeChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  rangeText: { color: colors.textMuted, fontWeight: "600", fontSize: 13 },
  rangeTextActive: { color: colors.background, fontWeight: "700", fontSize: 13 },
  itemName: { color: colors.text, fontSize: 16, fontWeight: "600" },
});
