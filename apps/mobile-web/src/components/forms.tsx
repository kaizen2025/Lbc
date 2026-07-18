import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Card, Muted } from "./ui";
import { trpc } from "../lib/trpc";
import { colors, radius, spacing } from "../theme";

/** Rangée de puces sélectionnables (état, langue, type d'annonce…). */
export function ChipRow({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => onChange(option.value)}
          style={[styles.chip, value === option.value && styles.chipActive]}
        >
          <Text style={value === option.value ? styles.chipTextActive : styles.chipText}>
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export interface PickedCard {
  id: number;
  name: string;
  number: string;
  setName: string;
  gameName: string;
}

/** Recherche dans le catalogue canonique et sélection d'une carte. */
export function CardPicker({ onSelect }: { onSelect: (card: PickedCard) => void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const results = trpc.catalog.searchCards.useQuery(
    { query, limit: 8 },
    { enabled: query.length >= 2 },
  );

  return (
    <View style={{ gap: spacing.sm }}>
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
        <Pressable
          key={card.id}
          onPress={() =>
            onSelect({
              id: card.id,
              name: card.name,
              number: card.number,
              setName: card.set.name,
              gameName: card.set.game.name,
            })
          }
        >
          <Card>
            <Text style={styles.cardName}>{card.name}</Text>
            <Muted>
              {card.set.game.name} · {card.set.name} · {card.number}
            </Muted>
          </Card>
        </Pressable>
      ))}
    </View>
  );
}

export const formStyles = StyleSheet.create({
  input: {
    backgroundColor: colors.background,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: radius.sm,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
  },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: spacing.sm + 4,
    alignItems: "center",
  },
  ctaText: { color: colors.background, fontSize: 16, fontWeight: "800" },
});

const styles = StyleSheet.create({
  chipRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: colors.background, fontWeight: "700", fontSize: 13 },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: radius.sm,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
  },
  cardName: { color: colors.text, fontSize: 15, fontWeight: "600" },
});
