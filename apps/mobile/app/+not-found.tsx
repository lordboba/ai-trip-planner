import { Link } from "expo-router";
import { SafeAreaView, StyleSheet, Text } from "react-native";

export default function NotFoundScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>That screen was not found.</Text>
      <Link href="/" style={styles.link}>Return to unlock</Link>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#FEFCFB",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1614",
  },
  link: {
    color: "#FF6B42",
    fontSize: 16,
  },
});
