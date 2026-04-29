import { useMemo } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useApp } from "../contexts/AppContext";
import { getTheme } from "../services/theme";
import LoginScreen from "../screens/LoginScreen";
import ArticleScreen from "../screens/ArticleScreen";
import ComposeScreen from "../screens/ComposeScreen";
import UserEditScreen from "../screens/UserEditScreen";
import UserProfileScreen from "../screens/UserProfileScreen";
import MainTabs from "./MainTabs";

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const { user, dark } = useApp();
  const theme = useMemo(() => getTheme(dark), [dark]);

  const navTheme = {
    ...DefaultTheme,
    dark,
    colors: {
      ...DefaultTheme.colors,
      background: theme.bg,
      card: theme.card,
      text: theme.text,
      border: theme.border,
      primary: theme.accent,
    },
  };

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.bg },
            animation: "slide_from_right",
          }}
        >
          {!user ? (
            <Stack.Screen name="Login" component={LoginScreen} />
          ) : (
            <>
              <Stack.Screen
                name="MainTabs"
                component={MainTabs}
                options={{
                  freezeOnBlur: false,
                  contentStyle: { backgroundColor: theme.bg },
                }}
              />
              <Stack.Screen
                name="Article"
                component={ArticleScreen}
                options={{
                  animation: "none",
                  freezeOnBlur: false,
                  contentStyle: { backgroundColor: theme.bg },
                }}
              />
              <Stack.Screen name="Compose" component={ComposeScreen} />
              <Stack.Screen name="UserEdit" component={UserEditScreen} />
              <Stack.Screen name="UserProfile" component={UserProfileScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export default AppNavigator;
