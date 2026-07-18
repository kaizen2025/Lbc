import { Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@cardtrade/i18n";
import { Card, Muted, Screen, SectionTitle } from "../../src/components/ui";
import { trpc } from "../../src/lib/trpc";
import { colors } from "../../src/theme";

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const nearby = trpc.listings.search.useQuery({ radiusKm: 50, cursor: 0, limit: 10 });

  return (
    <Screen>
      <SectionTitle>{t("home.nearYou")}</SectionTitle>
      {nearby.isLoading && <Muted>{t("common.loading")}</Muted>}
      {nearby.isError && <Muted>{t("common.error")}</Muted>}
      {nearby.data?.items.length === 0 && <Muted>{t("search.noResults")}</Muted>}
      {nearby.data?.items.map(({ listing, distanceKm }) => (
        <Card key={listing.id}>
          <Text style={styles.listingTitle}>
            {listing.description ?? `${t(`listing.${listing.type}`)} · #${listing.id.slice(0, 8)}`}
          </Text>
          <Muted>
            {listing.city ?? "—"} · {t("home.distanceAway", { distance: distanceKm.toFixed(1) })}
          </Muted>
          {listing.priceCents != null && (
            <Text style={styles.price}>
              {formatCurrency(listing.priceCents, listing.currency, i18n.language)}
            </Text>
          )}
        </Card>
      ))}

      <SectionTitle>{t("home.marketMovers")}</SectionTitle>
      <Card>
        <Muted>{t("home.justForYou")} — Phase 3 (cote EU/US, tendances)</Muted>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  listingTitle: { color: colors.text, fontSize: 16, fontWeight: "600" },
  price: { color: colors.accent, fontSize: 18, fontWeight: "700" },
});
