import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import type { CardCondition, CardLanguage, ListingType } from "@cardtrade/validators";
import { Card, Muted, Screen, SectionTitle } from "../../src/components/ui";
import { CardPicker, ChipRow, formStyles, type PickedCard } from "../../src/components/forms";
import { useSession } from "../../src/lib/auth";
import { pickAndUploadPhoto } from "../../src/lib/photos";
import { trpc } from "../../src/lib/trpc";
import { colors, radius, spacing } from "../../src/theme";

const CONDITIONS: CardCondition[] = ["near_mint", "excellent", "good", "played", "poor"];
const LANGUAGES: CardLanguage[] = ["fr", "en", "ja", "de", "es", "it"];
const TYPES: ListingType[] = ["sale", "trade", "wanted"];

export default function SellScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
  const utils = trpc.useUtils();

  const [card, setCard] = useState<PickedCard | null>(null);
  const [type, setType] = useState<ListingType>("sale");
  const [condition, setCondition] = useState<CardCondition>("near_mint");
  const [language, setLanguage] = useState<CardLanguage>("fr");
  const [isFoil, setIsFoil] = useState(false);
  const [price, setPrice] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoStatus, setPhotoStatus] = useState<string | null>(null);

  async function addPhoto() {
    if (!session || photos.length >= 3) return;
    setPhotoStatus(t("photos.uploading"));
    try {
      const url = await pickAndUploadPhoto(session.user.id);
      if (url) setPhotos((previous) => [...previous, url]);
      setPhotoStatus(null);
    } catch (error) {
      setPhotoStatus(error instanceof Error ? error.message : t("common.error"));
    }
  }

  const create = trpc.listings.create.useMutation({
    onSuccess: () => {
      setCard(null);
      setPrice("");
      setPhotos([]);
      void utils.listings.invalidate();
    },
  });

  function publish() {
    if (!card) return;
    const priceCents = Math.round(Number(price.replace(",", ".")) * 100);
    create.mutate({
      type,
      cardId: card.id,
      cardLanguage: language,
      condition,
      isFoil,
      quantity: 1,
      priceCents: Number.isFinite(priceCents) && priceCents > 0 ? priceCents : undefined,
      currency: "EUR",
      photos,
    });
  }

  if (!session) {
    return (
      <Screen>
        <SectionTitle>{t("listing.create")}</SectionTitle>
        <Card>
          <Muted>{t("auth.signInRequired")}</Muted>
          <Link href="/auth" asChild>
            <Pressable style={formStyles.cta}>
              <Text style={formStyles.ctaText}>{t("auth.signIn")}</Text>
            </Pressable>
          </Link>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionTitle>{t("listing.create")}</SectionTitle>
      <Card>
        <Text style={styles.emphasis}>{t("listing.handDeliveryOnly")}</Text>
        <Muted>{t("transaction.escrowNotice")}</Muted>
      </Card>

      <SectionTitle>{t("sell.pickCard")}</SectionTitle>
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
        <>
          <SectionTitle>{t("sell.details")}</SectionTitle>
          <Card>
            <Muted>{t("listing.sale")} / {t("listing.trade")} / {t("listing.wanted")}</Muted>
            <ChipRow
              options={TYPES.map((value) => ({ value, label: t(`listing.${value}`) }))}
              value={type}
              onChange={(value) => setType(value as ListingType)}
            />
            <Muted>{t("listing.condition.near_mint")} …</Muted>
            <ChipRow
              options={CONDITIONS.map((value) => ({
                value,
                label: t(`listing.condition.${value}`),
              }))}
              value={condition}
              onChange={(value) => setCondition(value as CardCondition)}
            />
            <Muted>{t("portfolio.cardLanguage")}</Muted>
            <ChipRow
              options={LANGUAGES.map((value) => ({
                value,
                label: value.toUpperCase(),
              }))}
              value={language}
              onChange={(value) => setLanguage(value as CardLanguage)}
            />
            <ChipRow
              options={[{ value: "foil", label: t("listing.foil") }]}
              value={isFoil ? "foil" : null}
              onChange={() => setIsFoil((previous) => !previous)}
            />
          </Card>

          <Card>
            <View style={styles.photoRow}>
              {photos.map((url) => (
                <Image key={url} source={{ uri: url }} style={styles.photoThumb} />
              ))}
              {photos.length < 3 && (
                <Pressable style={styles.photoAdd} onPress={() => void addPhoto()}>
                  <Text style={styles.photoAddText}>{t("photos.add")}</Text>
                </Pressable>
              )}
            </View>
            <Muted>
              {photoStatus ?? t("photos.count", { count: photos.length })}
            </Muted>
          </Card>

          <SectionTitle>{t("sell.pricing")}</SectionTitle>
          <Card>
            <TextInput
              style={formStyles.input}
              placeholder={t("sell.price")}
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={price}
              onChangeText={setPrice}
            />
            <Pressable
              style={formStyles.cta}
              onPress={publish}
              disabled={create.isPending}
            >
              <Text style={formStyles.ctaText}>
                {create.isPending ? t("common.loading") : t("sell.publish")}
              </Text>
            </Pressable>
            {create.isError && (
              <Muted>
                {create.error.data?.code === "PRECONDITION_FAILED"
                  ? t("sell.needProfile")
                  : create.error.message}
              </Muted>
            )}
          </Card>
        </>
      )}
      {/* Hors du bloc `card &&` : le succès reste visible après le reset du formulaire */}
      {create.isSuccess && !card && (
        <Card>
          <Text style={styles.success}>{t("sell.published")}</Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  emphasis: { color: colors.gold, fontSize: 15, fontWeight: "600" },
  cardName: { color: colors.text, fontSize: 16, fontWeight: "700" },
  change: { color: colors.accent, fontWeight: "600" },
  success: { color: colors.positive, fontSize: 16, fontWeight: "700" },
  photoRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  photoThumb: { width: 84, height: 84, borderRadius: radius.sm },
  photoAdd: {
    width: 84,
    height: 84,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  photoAddText: { color: colors.accent, fontSize: 12, textAlign: "center" },
});
