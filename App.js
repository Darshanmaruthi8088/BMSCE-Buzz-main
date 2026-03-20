import { StatusBar } from "expo-status-bar";
import { AppProvider, useApp } from "./contexts/AppContext";
import AppNavigator from "./navigation/AppNavigator";
import { getTheme } from "./services/theme";

const AppShell = () => {
  const { dark } = useApp();
  const theme = getTheme(dark);
  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} backgroundColor={theme.bg} translucent={false} />
      <AppNavigator />
    </>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
