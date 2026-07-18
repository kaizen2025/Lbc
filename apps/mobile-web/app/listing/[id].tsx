import { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@cardtrade/i18n";
import { Card, Muted, Screen, SectionTitle } from "../../src/components/ui";
import { formStyles } from "../../src/components/forms";
import { useSession } from "../../src/lib/auth";
import { trpc } from "../../src/lib/trpc";
import { colors, spacing } from "../../src/theme";

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const utils = trpc.useUtils();

  const listing = trpc.listings.byId.useQuery({ id: id! }, { enabled: !!id });
  const me = trpc.profile.me.useQuery(undefined, {
    retry: false,
    enabled: !!session,
  });
  const isMine =
    me.data != null && listing.data != null && listing.data.sellerId === me.data.id;

  const offers = trpc.offers.forListing.useQuery(
    { listingId: id! },
    { enabled: !!id && !!session },
  );
  const [offerAmount, setOfferAmount] = useState("");
  const [message, setMessage] = useState("");

  const createOffer = trpc.offers.create.useMutation({
    onSuccess: () => void utils.offers.forListing.invalidate(),
  });
  const respondOffer = trpc.offers.respond.useMutation({
    onSuccess: () => void utils.offers.forListing.invalidate(),
  });
  const createTx = trpc.transactions.createFromOffer.useMutation({
    onSuccess: (tx) => tx && router.push(`/transaction/${tx.id}`),
  });
  const sendMessage = trpc.chat.send.useMutation({
    onSuccess: (created) =>
      created && router.push(`/conversation/${created.conversationId}`),
  });
  const createAlert = trpc.alerts.create.useMutation();

  if (!listing.data) {
    return (
      <Screen>
        <Muted>{listing.isError ? t("common.error") : t("common.loading")}</Muted>
      </Screen>
    );
  }

  const item = listing.data;
  const title = item.card?.name ?? item.sealedProduct?.name ?? "—";

  return (
    <Screen>
      <Text style={styles.title}>{title}</Text>
      {item.photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.gallery}>
            {item.photos.map((url) => (
              <Image key={url} source={{ uri: url }} style={styles.photo} />
            ))}
          </View>
        </ScrollView>
      )}
      <Card>
        <Muted>
          {t(`listing.${item.type}`)}
          {item.condition ? ` · ${t(`listing.condition.${item.condition}`)}` : ""}
          {item.cardLanguage ? ` · ${item.cardLanguage.toUpperCase()}` : ""}
          {item.isFoil ? ` · ${t("listing.foil")}` : ""}
        </Muted>
        {item.priceCents != null && (
          <Text style={styles.price}>
            {formatCurrency(item.priceCents, item.currency, i18n.language)}
          </Text>
        )}
        <Muted>
          {t("listingDetail.seller")} : @{item.seller.profile?.username ?? "?"} ·{" "}
          {item.city ?? "—"}
        </Muted>
        <Text style={styles.notice}>{t("listing.handDeliveryOnly")}</Text>
      </Card>

      {isMine ? (
        <>
          <Muted>{t("listingDetail.yourListing")}</Muted>
          <SectionTitle>{t("listingDetail.offers")}</SectionTitle>
          {offers.data?.length === 0 && <Muted>—</Muted>}
          {offers.data?.map((offer) => (
            <Card key={offer.id}>
              <Text style={styles.offerAmount}>
                @{offer.buyer.profile?.username ?? "?"} ·{" "}
                {offer.amountCents != null
                  ? formatCurrency(offer.amountCents, item.currency, i18n.language)
                  : t("listing.trade")}
              </Text>
              {offer.message && <Muted>{offer.message}</Muted>}
              {offer.status === "pending" ? (
                <View style={styles.row}>
                  <Pressable
                    style={[formStyles.cta, styles.flex]}
                    onPress={() =>
                      respondOffer.mutate({ offerId: offer.id, action: "accept" })
                    }
                  >
                    <Text style={formStyles.ctaText}>{t("listingDetail.accept")}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.declineButton, styles.flex]}
                    onPress={() =>
                      respondOffer.mutate({ offerId: offer.id, action: "decline" })
                    }
                  >
                    <Text style={styles.declineText}>{t("listingDetail.decline")}</Text>
                  </Pressable>
                  {respondOffer.isError && <Muted>{respondOffer.error.message}</Muted>}
                </View>
              ) : (
                <Muted>{t(`listingDetail.${offer.status}`)}</Muted>
              )}
            </Card>
          ))}
        </>
      ) : session ? (
        <>
          <SectionTitle>{t("listingDetail.makeOffer")}</SectionTitle>
          <Card>
            <TextInput
              style={formStyles.input}
              placeholder={t("listingDetail.offerAmount")}
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={offerAmount}
              onChangeText={setOfferAmount}
            />
            <Pressable
              style={formStyles.cta}
              // Jamais d'offre à 0 € par défaut : un montant vide/invalide ne
              // doit pas court-circuiter le séquestre côté serveur.
              disabled={
                createOffer.isPending ||
                !(Math.round(Number(offerAmount.replace(",", ".")) * 100) > 0)
              }
              onPress={() => {
                const cents = Math.round(Number(offerAmount.replace(",", ".")) * 100);
                if (!Number.isFinite(cents) || cents <= 0) return;
                createOffer.mutate({
                  listingId: item.id,
                  amountCents: cents,
                  tradeItemIds: [],
                });
              }}
            >
              <Text style={formStyles.ctaText}>{t("listingDetail.sendOffer")}</Text>
            </Pressable>
            {createOffer.isSuccess && <Muted>{t("listingDetail.offerSent")}</Muted>}
            {createOffer.isError && <Muted>{createOffer.error.message}</Muted>}
          </Card>

          {offers.data?.some((offer) => offer.status === "accepted") && (
            <>
              <Pressable
                style={formStyles.cta}
                onPress={() => {
                  const accepted = offers.data?.find((o) => o.status === "accepted");
                  if (accepted) createTx.mutate({ offerId: accepted.id });
                }}
              >
                <Text style={formStyles.ctaText}>
                  {t("listingDetail.concludeTrade")}
                </Text>
              </Pressable>
              {createTx.isError && <Muted>{createTx.error.message}</Muted>}
            </>
          )}

          {item.cardId != null && (
            <Card>
              <Pressable
                disabled={createAlert.isPending || createAlert.isSuccess}
                onPress={() =>
                  createAlert.mutate({
                    cardId: item.cardId!,
                    cardLanguage: item.cardLanguage ?? undefined,
                  })
                }
              >
                <Text style={styles.alertButton}>{t("alerts.create")}</Text>
              </Pressable>
              {createAlert.isSuccess && <Muted>{t("alerts.created")}</Muted>}
              {createAlert.isError && (
                <Muted>
                  {createAlert.error.message.startsWith("PRO_REQUIRED")
                    ? t("alerts.limit")
                    : createAlert.error.message}
                </Muted>
              )}
            </Card>
          )}

          <SectionTitle>{t("listing.contactSeller")}</SectionTitle>
          <Card>
            <TextInput
              style={formStyles.input}
              placeholder={t("listingDetail.messagePlaceholder")}
              placeholderTextColor={colors.textMuted}
              value={message}
              onChangeText={setMessage}
            />
            <Pressable
              style={formStyles.cta}
              disabled={sendMessage.isPending || message.length === 0}
              onPress={() => sendMessage.mutate({ listingId: item.id, body: message })}
            >
              <Text style={formStyles.ctaText}>{t("listingDetail.send")}</Text>
            </Pressable>
            {sendMessage.isError && <Muted>{sendMessage.error.message}</Muted>}
          </Card>
        </>
      ) : (
        <Card>
          <Muted>{t("auth.signInRequired")}</Muted>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 24, fontWeight: "800" },
  price: { color: colors.accent, fontSize: 26, fontWeight: "800" },
  notice: { color: colors.gold, fontSize: 14, fontWeight: "600" },
  offerAmount: { color: colors.text, fontSize: 16, fontWeight: "700" },
  row: { flexDirection: "row", gap: spacing.sm },
  flex: { flex: 1 },
  declineButton: {
    borderColor: colors.negative,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: spacing.sm + 4,
    alignItems: "center",
  },
  declineText: { color: colors.negative, fontWeight: "700" },
  alertButton: { color: colors.gold, fontSize: 16, fontWeight: "700" },
  gallery: { flexDirection: "row", gap: spacing.sm },
  photo: { width: 220, height: 220, borderRadius: 12 },
});
