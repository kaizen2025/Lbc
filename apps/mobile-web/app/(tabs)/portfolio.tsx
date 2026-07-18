import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Link, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@cardtrade/i18n";
import { Card, Muted, PriceChange, Screen, SectionTitle } from "../../src/components/ui";
import { Sparkline } from "../../src/components/Sparkline";
import { useSession } from "../../src/lib/auth";
import { trpc } from "../../src/lib/trpc";
import { colors, radius, spacing } from "../../src/theme";

const RANGES = ["1d", "7d", "1m", "3m", "6m", "max"] as const;
type Range = (typeof RANGES)[number];
/** Plages réservées aux abonnés PRO (badge sur la puce, paywall si activée). */
const PRO_RANGES: readonly Range[] = ["6m", "max"];

export default function PortfolioScreen() {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const [range, setRange] = useState<Range>("1m");
  const [market, setMarket] = useState<"eu" | "us">("eu");

  const history = trpc.collection.portfolioHistory.useQuery(
    { range, market },
    { retry: false, enabled: !!session },
  );
  const items = trpc.collection.list.useQuery(undefined, {
    retry: false,
    enabled: !!session,
  });
  const utils = trpc.useUtils();
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  async function exportCsv() {
    if (Platform.OS !== "web") {
      setExportStatus(t("exportCsv.webOnly"));
      return;
    }
    try {
      const { csv, count } = await utils.collection.exportCsv.fetch();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "cardtrade-collection.csv";
      anchor.click();
      URL.revokeObjectURL(url);
      setExportStatus(t("exportCsv.done", { count }));
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("PRO_REQUIRED")) {
        router.push("/paywall");
      } else {
        setExportStatus(t("common.error"));
      }
    }
  }

  const points = history.data ?? [];
  const latest = points[points.length - 1]?.totalCents ?? 0;
  const first = points[0]?.totalCents ?? latest;
  const delta = latest - first;
  const currency = market === "eu" ? "EUR" : "USD";
  const proRequired = history.error?.message.startsWith("PRO_REQUIRED") ?? false;

  return (
    <Screen>
      <SectionTitle>{t("portfolio.title")}</SectionTitle>

      <Card style={styles.hero}>
        <Muted>{t("portfolio.totalValue")}</Muted>
        <Text style={styles.totalValue}>
          {formatCurrency(latest, currency, i18n.language)}
        </Text>
        <PriceChange
          cents={delta}
          percent={first ? (delta / first) * 100 : 0}
          currency={currency}
        />

        <Sparkline points={points.map((p) => p.totalCents)} />

        <View style={styles.rangeRow}>
          {RANGES.map((r) => (
            <Pressable
              key={r}
              onPress={() => setRange(r)}
              style={[styles.rangeChip, range === r && styles.rangeChipActive]}
            >
              <Text style={range === r ? styles.rangeTextActive : styles.rangeText}>
                {r.toUpperCase()}
                {PRO_RANGES.includes(r) ? ` ${t("paywall.proBadge")}` : ""}
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
              {t("portfolio.usMarket")} {t("paywall.proBadge")}
            </Text>
          </Pressable>
        </View>

        {proRequired && (
          <Link href="/paywall" asChild>
            <Pressable style={styles.proUpsell}>
              <Text style={styles.proUpsellText}>{t("paywall.unlockPro")} →</Text>
            </Pressable>
          </Link>
        )}
      </Card>

      <SectionTitle>{t("portfolio.mostValuable")}</SectionTitle>
      <Link href="/collection-add" asChild>
        <Pressable style={styles.addButton}>
          <Text style={styles.addButtonText}>+ {t("portfolio.addCard")}</Text>
        </Pressable>
      </Link>
      <Pressable style={styles.addButton} onPress={() => void exportCsv()}>
        <Text style={styles.addButtonText}>
          {t("exportCsv.button")} {t("paywall.proBadge")}
        </Text>
      </Pressable>
      {exportStatus && <Muted>{exportStatus}</Muted>}
      {items.isError && <Muted>{t("auth.signIn")}</Muted>}
      {items.data?.map((item) => (
        <Card key={item.id}>
          <View style={styles.itemRow}>
            <Text style={[styles.itemName, styles.itemNameFlex]}>
              {item.card?.name ?? item.sealedProduct?.name}
              {item.isFoil ? " ✦" : ""}
            </Text>
            {item.valueCents != null && (
              <Text style={styles.itemValue}>
                {formatCurrency(item.valueCents, "EUR", i18n.language)}
              </Text>
            )}
          </View>
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
  itemNameFlex: { flex: 1 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  itemValue: { color: colors.accent, fontSize: 16, fontWeight: "800" },
  proUpsell: {
    backgroundColor: colors.gold,
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  proUpsellText: { color: colors.background, fontWeight: "800", fontSize: 15 },
  addButton: {
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  addButtonText: { color: colors.accent, fontWeight: "700", fontSize: 15 },
});
