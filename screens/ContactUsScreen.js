import { useMemo } from "react";
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppHeader from "../components/AppHeader";
import Avatar from "../components/Avatar";
import { useApp } from "../contexts/AppContext";
import { getTheme } from "../services/theme";

const PLACEHOLDER_LOGO = require("../assets/app-logo.png");

const CREATORS = [
  {
    id: "darshan",
    name: "Darshan",
    email: "darshan.cs24@bmsce.ac.in",
    initials: "D",
    photo: require("../assets/creators/Darshan.jpg.jpeg"),
  },
  {
    id: "darshan-pn",
    name: "Darshan PN",
    email: "darshanpn.cs24@bmsce.ac.in",
    initials: "DP",
    usePlaceholderLogo: true,
  },
  {
    id: "aneesh-ts",
    name: "Aneesh T.S",
    email: "aneeshts.cs24@bmsce.ac.in",
    initials: "AT",
    photo: require("../assets/creators/Aneesh T.S.jpg.jpeg"),
  },
  {
    id: "aneesh-ggs",
    name: "Aneesh GGS",
    email: "aneesha.ec24@bmsce.ac.in",
    initials: "AG",
    photo: require("../assets/creators/Aneesh GGS.jpg.jpeg"),
  },
];

const PHOTO_SIZE = 76;

const CreatorPhoto = ({ creator, theme, size = PHOTO_SIZE }) => {
  const radius = size / 2;
  const frameStyle = {
    width: size,
    height: size,
    borderRadius: radius,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: theme.border,
    backgroundColor: theme.card2,
  };

  if (creator.usePlaceholderLogo) {
    return (
      <View style={[frameStyle, styles.placeholderWrap]}>
        <Image source={PLACEHOLDER_LOGO} style={styles.placeholderLogo} resizeMode="contain" />
      </View>
    );
  }
  if (creator.photo) {
    return (
      <View style={frameStyle}>
        <Image source={creator.photo} style={{ width: size, height: size }} resizeMode="cover" />
      </View>
    );
  }
  if (creator.photoUrl) {
    return (
      <View style={frameStyle}>
        <Avatar initials={creator.initials} imageUrl={creator.photoUrl} size={size} />
      </View>
    );
  }
  return (
    <View style={frameStyle}>
      <Avatar initials={creator.initials} size={size} />
    </View>
  );
};

const ContactUsScreen = () => {
  const navigation = useNavigation();
  const { dark } = useApp();
  const theme = useMemo(() => getTheme(dark), [dark]);
  const insets = useSafeAreaInsets();

  const openMail = async (email) => {
    const url = `mailto:${email.trim()}`;
    try {
      await Linking.openURL(url);
    } catch {
      try {
        const can = await Linking.canOpenURL(url);
        if (can) await Linking.openURL(url);
      } catch {
        // No mail handler available
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <AppHeader
        theme={theme}
        title="Contact us"
        subtitle="BMSCE Buzz creators"
        showBack
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Math.max(24, insets.bottom + 100) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.intro, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="mail-outline" size={22} color={theme.accent} />
          <Text style={[styles.introTitle, { color: theme.text }]}>Reach the team</Text>
          <Text style={[styles.introBody, { color: theme.text2 }]}>
            Tap an email to open your mail app. We’d love to hear feedback or ideas for the campus feed.
          </Text>
        </View>

        {CREATORS.map((c) => (
          <View
            key={c.id}
            style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <CreatorPhoto creator={c} theme={theme} size={PHOTO_SIZE} />
            <View style={styles.cardBody}>
              <Text style={[styles.name, { color: theme.text }]}>{c.name}</Text>
              {!c.usePlaceholderLogo ? (
                <Text style={[styles.label, { color: theme.text3 }]}>Creator</Text>
              ) : null}
              <Pressable
                onPress={() => openMail(c.email)}
                style={({ pressed }) => [
                  styles.emailRow,
                  pressed && { opacity: 0.75 },
                ]}
                android_ripple={{ color: `${theme.accent2}33` }}
              >
                <Ionicons name="mail-outline" size={16} color={theme.accent2} />
                <Text style={[styles.email, { color: theme.accent2 }]} numberOfLines={2}>
                  {c.email}
                </Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 14,
    paddingTop: 16,
    gap: 12,
  },
  intro: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  introTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  introBody: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    gap: 14,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  label: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  email: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
  },
  placeholderWrap: {
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
  },
  placeholderLogo: {
    width: "100%",
    height: "100%",
    opacity: 0.85,
  },
});

export default ContactUsScreen;
