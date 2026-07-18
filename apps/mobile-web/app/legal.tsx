import { StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { Screen, SectionTitle } from "../src/components/ui";
import { colors } from "../src/theme";

export default function LegalScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <SectionTitle>{t("legal.title")}</SectionTitle>
      <Text style={styles.body}>{t("legal.body")}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.textMuted, fontSize: 15, lineHeight: 23 },
});
