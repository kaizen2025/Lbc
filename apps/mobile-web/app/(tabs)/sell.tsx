import { StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { Card, Muted, Screen, SectionTitle } from "../../src/components/ui";
import { colors } from "../../src/theme";

export default function SellScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
      <SectionTitle>{t("listing.create")}</SectionTitle>
      <Card>
        <Text style={styles.emphasis}>{t("listing.handDeliveryOnly")}</Text>
        <Muted>{t("transaction.escrowNotice")}</Muted>
      </Card>
      <Card>
        <Muted>
          Formulaire d'annonce (choix de la carte via le catalogue ou scan — Phase 4,
          photos, état, langue, prix) : branché sur listings.create.
        </Muted>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  emphasis: { color: colors.gold, fontSize: 15, fontWeight: "600" },
});
