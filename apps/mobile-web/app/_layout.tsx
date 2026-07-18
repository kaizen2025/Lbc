import "../src/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTrpcClient, trpc } from "../src/lib/trpc";
import { SessionProvider, useSession } from "../src/lib/auth";
import { colors } from "../src/theme";

/** Vide le cache react-query à chaque changement d'utilisateur (login/logout) —
 *  sinon les onglets gardent les erreurs 401 ou les données de l'ancien compte. */
function AuthCacheReset({ queryClient }: { queryClient: QueryClient }) {
  const { session } = useSession();
  const previousUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const userId = session?.user.id ?? null;
    if (previousUserId.current !== undefined && previousUserId.current !== userId) {
      queryClient.clear();
    }
    previousUserId.current = userId;
  }, [session?.user.id, queryClient]);
  return null;
}

export default function RootLayout() {
  const { t } = useTranslation();
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() => createTrpcClient());

  return (
    <SessionProvider>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <AuthCacheReset queryClient={queryClient} />
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.text,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="paywall"
              options={{ presentation: "modal", title: "CardTrade PRO" }}
            />
            <Stack.Screen
              name="auth"
              options={{ presentation: "modal", title: t("auth.signIn") }}
            />
            <Stack.Screen
              name="profile-edit"
              options={{ presentation: "modal", title: t("profileEdit.title") }}
            />
            <Stack.Screen
              name="collection-add"
              options={{ presentation: "modal", title: t("collectionAdd.title") }}
            />
            <Stack.Screen name="listing/[id]" options={{ title: "" }} />
            <Stack.Screen name="conversation/[id]" options={{ title: "" }} />
            <Stack.Screen
              name="transaction/[id]"
              options={{ title: t("tx.title") }}
            />
          </Stack>
        </QueryClientProvider>
      </trpc.Provider>
    </SessionProvider>
  );
}
