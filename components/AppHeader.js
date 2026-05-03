import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Avatar from "./Avatar";

const AppHeader = ({
  theme,
  title,
  subtitle,
  showBack = false,
  onBack,
  rightActions,
  avatar,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.header,
          borderBottomColor: theme.border,
          paddingTop: Math.max(12, insets.top + 8),
        },
      ]}
    > 
      <View style={styles.row}>
        <View style={styles.leftWrap}>
          {showBack ? (
            <Pressable
              onPress={onBack}
              style={[styles.roundButton, { borderColor: theme.border, backgroundColor: theme.card2 }]}
            >
              <Feather name="chevron-left" size={18} color={theme.text} />
            </Pressable>
          ) : null}

          <View style={styles.titleWrap}>
            {title ? <Text style={[styles.title, { color: theme.text }]}>{title}</Text> : null}
            {subtitle ? <Text style={[styles.subtitle, { color: theme.text2 }]}>{subtitle}</Text> : null}
          </View>
        </View>

        <View style={styles.rightWrap}>
          {rightActions}
          {avatar ? (
            <Avatar
              initials={avatar.initials}
              imageUrl={avatar.imageUrl}
              size={34}
              color="#F59E0B"
              enablePreview={false}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
};

export const HeaderAction = ({ theme, icon, onPress, active = false }) => (
  <Pressable
    onPress={onPress}
    style={[
      styles.roundButton,
      {
        borderColor: active ? theme.accent : theme.border,
        backgroundColor: active ? `${theme.accent}1A` : theme.card2,
      },
    ]}
  >
    <Ionicons name={icon} size={16} color={active ? theme.accent : theme.text2} />
  </Pressable>
);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  leftWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  rightWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  roundButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  titleWrap: {
    flexShrink: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 1,
    fontSize: 11,
    fontWeight: "600",
  },
});

export default AppHeader;
