import { StyleSheet, Text, View } from "react-native";
import { CATEGORY_COLORS } from "../services/constants";
import { formatRoleLabel } from "../services/utils";

export const Badge = ({ text, color = "#F59E0B", small = false }) => (
  <View
    style={[
      styles.badge,
      {
        backgroundColor: color,
        paddingVertical: small ? 2 : 3,
        paddingHorizontal: small ? 8 : 10,
      },
    ]}
  >
    <Text style={[styles.badgeText, { fontSize: small ? 10 : 11 }]} numberOfLines={1}>
      {text}
    </Text>
  </View>
);

export const CategoryBadge = ({ category, small = false }) => (
  <Badge text={category} color={CATEGORY_COLORS[category] || "#475569"} small={small} />
);

export const RoleBadge = ({ role, userType }) => {
  const map = {
    user: "#3B82F6",
    admin: "#7C3AED",
    student: "#3B82F6",
    faculty: "#059669",
    superadmin: "#DC2626",
  };
  return <Badge text={formatRoleLabel(role, userType)} color={map[role] || "#475569"} />;
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  badgeText: {
    color: "#FFFFFF",
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
});
