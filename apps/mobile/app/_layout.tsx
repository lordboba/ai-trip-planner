import { Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { TripPlannerStateProvider } from "@/src/state/trip-planner-state";

WebBrowser.maybeCompleteAuthSession();

export default function RootLayout() {
  return (
    <TripPlannerStateProvider>
      <Stack
        screenOptions={{
          headerTintColor: "#1A1614",
          headerStyle: { backgroundColor: "#FEFCFB" },
          contentStyle: { backgroundColor: "#FEFCFB" },
        }}
      />
    </TripPlannerStateProvider>
  );
}
