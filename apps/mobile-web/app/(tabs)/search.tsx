import { useState } from "react";
import { StyleSheet, Text, TextInput } from "react-native";
import { useTranslation } from "react-i18next";
import { Card, Muted, Screen } from "../../src/components/ui";
import { trpc } from "../../src/lib/trpc";
import { colors, radius, spacing } from "../../src/theme";

export default function SearchScreen() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const results = trpc.catalog.searchCards.useQuery(
    { query, limit: 20 },
    { enabled: query.length >= 2 },
  );

  return (
    <Screen>
      <TextInput
        style={styles.input}
        placeholder={t("search.placeholder")}
        placeholderTextColor={colors.textMuted}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
      />
      {results.isFetching && <Muted>{t("common.loading")}</Muted>}
      {results.data?.map((card) => (
        <Card key={card.id}>
          <Text style={styles.cardName}>{card.name}</Text>
          <Muted>
            {card.set.game.name} · {card.set.name} · {card.number}
          </Muted>
        </Card>
      ))}
      {query.length >= 2 && results.data?.length === 0 && (
        <Muted>{t("search.noResults")}</Muted>
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
});
