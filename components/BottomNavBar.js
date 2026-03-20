import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const iconMap = {
  home: "home-outline",
  search: "search-outline",
  events: "calendar-outline",
  notifs: "notifications-outline",
  admin: "shield-checkmark-outline",
  profile: "person-outline",
};

const activeIconMap = {
  home: "home",
  search: "search",
  events: "calendar",
  notifs: "notifications",
  admin: "shield-checkmark",
  profile: "person",
};

const BottomNavBar = ({ state, descriptors, navigation, theme, canPost, onCompose }) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.nav,
          borderTopColor: theme.border,
          paddingBottom: insets.bottom > 0 ? insets.bottom + 6 : styles.container.paddingBottom,
        },
      ]}
    > 
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const label = options.tabBarLabel ?? options.title ?? route.name;
        const iconKey = options.tabBarIconKey || route.name.toLowerCase();
        const badge = options.tabBarBadge;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable key={route.key} onPress={onPress} style={styles.tabButton}>
            <View style={styles.iconWrap}>
              <Ionicons
                name={isFocused ? activeIconMap[iconKey] || "ellipse" : iconMap[iconKey] || "ellipse-outline"}
                size={20}
                color={isFocused ? theme.accent : theme.text3}
              />
              {badge ? (
                <View style={styles.badgeDot}>
                  <Text style={styles.badgeText}>{badge > 9 ? "9+" : `${badge}`}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, { color: isFocused ? theme.accent : theme.text3 }]}>{label}</Text>
          </Pressable>
        );
      })}

      {canPost ? (
        <Pressable onPress={onCompose} style={[styles.fab, { borderColor: theme.bg }]}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 10,
    position: "relative",
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 5,
  },
  iconWrap: {
    position: "relative",
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
  },
  badgeDot: {
    position: "absolute",
    top: -4,
    right: -8,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    paddingHorizontal: 2,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 8,
    color: "#FFFFFF",
    fontWeight: "900",
  },
  fab: {
    position: "absolute",
    right: 14,
    top: -34,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F59E0B",
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
  },
});

export default BottomNavBar;
