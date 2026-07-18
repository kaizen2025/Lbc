import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput } from "react-native";
import { useTranslation } from "react-i18next";
import type { CardCondition, CardLanguage } from "@cardtrade/validators";
import { Card, Muted, Screen, SectionTitle } from "../src/components/ui";
import { CardPicker, ChipRow, formStyles, type PickedCard } from "../src/components/forms";
import { trpc } from "../src/lib/trpc";
import { colors } from "../src/theme";

const CONDITIONS: CardCondition[] = ["near_mint", "excellent", "good", "played", "poor"];
const LANGUAGES: CardLanguage[] = ["fr", "en", "ja", "de", "es", "it"];

export default function CollectionAddScreen() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const [card, setCard] = useState<PickedCard | null>(null);
  const [condition, setCondition] = useState<CardCondition>("near_mint");
  const [language, setLanguage] = useState<CardLanguage>("fr");
  const [isFoil, setIsFoil] = useState(false);
  const [quantity, setQuantity] = useState("1");

  const add = trpc.collection.add.useMutation({
    onSuccess: () => {
      setCard(null);
      void utils.collection.invalidate();
    },
  });

  return (
    <Screen>
      <SectionTitle>{t("collectionAdd.title")}</SectionTitle>
      {card ? (
        <Card>
          <Text style={styles.cardName}>{card.name}</Text>
          <Muted>
            {card.gameName} · {card.setName} · {card.number}
          </Muted>
          <Pressable onPress={() => setCard(null)}>
            <Text style={styles.change}>{t("sell.changeCard")}</Text>
          </Pressable>
        </Card>
      ) : (
        <CardPicker onSelect={setCard} />
      )}

      {card && (
        <Card>
          <ChipRow
            options={CONDITIONS.map((value) => ({
              value,
              label: t(`listing.condition.${value}`),
            }))}
            value={condition}
            onChange={(value) => setCondition(value as CardCondition)}
          />
          <ChipRow
            options={LANGUAGES.map((value) => ({ value, label: value.toUpperCase() }))}
            value={language}
            onChange={(value) => setLanguage(value as CardLanguage)}
          />
          <ChipRow
            options={[{ value: "foil", label: t("listing.foil") }]}
            value={isFoil ? "foil" : null}
            onChange={() => setIsFoil((previous) => !previous)}
          />
          <TextInput
            style={formStyles.input}
            placeholder={t("listing.quantity")}
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            value={quantity}
            onChangeText={setQuantity}
          />
          <Pressable
            style={formStyles.cta}
            disabled={add.isPending}
            onPress={() =>
              add.mutate({
                cardId: card.id,
                cardLanguage: language,
                condition,
                isFoil,
                quantity: Math.max(1, Number(quantity) || 1),
              })
            }
          >
            <Text style={formStyles.ctaText}>
              {add.isPending ? t("common.loading") : t("collectionAdd.add")}
            </Text>
          </Pressable>
          {add.isError && (
            <Muted>
              {add.error.message.startsWith("PRO_REQUIRED")
                ? t("paywall.unlockPro")
                : add.error.message}
            </Muted>
          )}
        </Card>
      )}
      {/* Hors du bloc `card &&` : le succès reste visible après le reset */}
      {add.isSuccess && !card && (
        <Card>
          <Text style={styles.success}>{t("collectionAdd.added")}</Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardName: { color: colors.text, fontSize: 16, fontWeight: "700" },
  change: { color: colors.accent, fontWeight: "600" },
  success: { color: colors.positive, fontSize: 16, fontWeight: "700" },
});
