import { useMemo } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import BottomNavBar from "../components/BottomNavBar";
import TabSwipeWrapper from "../components/TabSwipeWrapper";
import { useApp } from "../contexts/AppContext";
import { getTheme } from "../services/theme";
import HomeScreen from "../screens/HomeScreen";
import SearchScreen from "../screens/SearchScreen";
import EventsScreen from "../screens/EventsScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import AdminScreen from "../screens/AdminScreen";
import ProfileScreen from "../screens/ProfileScreen";

const Tab = createBottomTabNavigator();
const SwipeHomeScreen = (props) => (
  <TabSwipeWrapper>
    <HomeScreen {...props} />
  </TabSwipeWrapper>
);
const SwipeSearchScreen = (props) => (
  <TabSwipeWrapper>
    <SearchScreen {...props} />
  </TabSwipeWrapper>
);
const SwipeEventsScreen = (props) => (
  <TabSwipeWrapper>
    <EventsScreen {...props} />
  </TabSwipeWrapper>
);
const SwipeNotificationsScreen = (props) => (
  <TabSwipeWrapper>
    <NotificationsScreen {...props} />
  </TabSwipeWrapper>
);
const SwipeAdminScreen = (props) => (
  <TabSwipeWrapper>
    <AdminScreen {...props} />
  </TabSwipeWrapper>
);
const SwipeProfileScreen = (props) => (
  <TabSwipeWrapper>
    <ProfileScreen {...props} />
  </TabSwipeWrapper>
);

const MainTabs = ({ navigation }) => {
  const { dark, isAdmin, user, unreadCount } = useApp();
  const theme = useMemo(() => getTheme(dark), [dark]);

  return (
    <Tab.Navigator
      initialRouteName="Home"
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.bg },
      }}
      tabBar={(props) => (
        <BottomNavBar
          {...props}
          theme={theme}
          canPost={!!user}
          onCompose={() => navigation.navigate("Compose")}
        />
      )}
    >
      <Tab.Screen
        name="Home"
        component={SwipeHomeScreen}
        options={{
          tabBarLabel: "Feed",
          tabBarIconKey: "home",
        }}
      />
      <Tab.Screen
        name="Search"
        component={SwipeSearchScreen}
        options={{
          tabBarLabel: "Search",
          tabBarIconKey: "search",
        }}
      />
      <Tab.Screen
        name="Events"
        component={SwipeEventsScreen}
        options={{
          tabBarLabel: "Events",
          tabBarIconKey: "events",
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={SwipeNotificationsScreen}
        options={{
          tabBarLabel: "Alerts",
          tabBarIconKey: "notifs",
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
        }}
      />
      {isAdmin ? (
        <Tab.Screen
          name="Admin"
          component={SwipeAdminScreen}
          options={{
            tabBarLabel: "Admin",
            tabBarIconKey: "admin",
          }}
        />
      ) : null}
      <Tab.Screen
        name="Profile"
        component={SwipeProfileScreen}
        options={{
          tabBarLabel: "Profile",
          tabBarIconKey: "profile",
        }}
      />
    </Tab.Navigator>
  );
};

export default MainTabs;
