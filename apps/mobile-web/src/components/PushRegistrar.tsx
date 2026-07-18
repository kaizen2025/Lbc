import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { useSession } from "../lib/auth";
import { trpc } from "../lib/trpc";

/**
 * Enregistre le token push Expo du device (natif uniquement — le web n'a pas
 * de push Expo). Best-effort : toute erreur (permission refusée, Expo Go sans
 * projectId…) est silencieuse.
 */
export function PushRegistrar() {
  const { session } = useSession();
  const register = trpc.notifications.registerPushToken.useMutation();

  useEffect(() => {
    if (!session || Platform.OS === "web") return;
    void (async () => {
      try {
        if (!Device.isDevice) return;
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== "granted") return;
        const { data: token } = await Notifications.getExpoPushTokenAsync();
        register.mutate({
          token,
          platform: Platform.OS === "ios" ? "ios" : "android",
        });
      } catch {
        // pas bloquant : l'email Brevo reste le canal de secours
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  return null;
}
