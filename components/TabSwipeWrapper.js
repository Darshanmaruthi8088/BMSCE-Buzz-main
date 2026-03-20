import { useRef } from "react";
import { PanResponder, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";

const SWIPE_DISTANCE_THRESHOLD = 70;
const SWIPE_VELOCITY_THRESHOLD = 0.25;

const TabSwipeWrapper = ({ children }) => {
  const navigation = useNavigation();
  const route = useRoute();

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isMostlyHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        return isMostlyHorizontal && Math.abs(gestureState.dx) > 16;
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx, dy, vx } = gestureState;
        if (Math.abs(dy) > Math.abs(dx)) return;

        const shouldGoNext = dx < -SWIPE_DISTANCE_THRESHOLD || vx < -SWIPE_VELOCITY_THRESHOLD;
        const shouldGoPrev = dx > SWIPE_DISTANCE_THRESHOLD || vx > SWIPE_VELOCITY_THRESHOLD;
        if (!shouldGoNext && !shouldGoPrev) return;

        const navState = navigation.getState?.();
        const routes = Array.isArray(navState?.routes) ? navState.routes : [];
        if (!routes.length) return;

        const currentIndex = routes.findIndex((item) => item.name === route.name);
        if (currentIndex < 0) return;

        if (shouldGoNext && currentIndex < routes.length - 1) {
          navigation.navigate(routes[currentIndex + 1].name);
          return;
        }
        if (shouldGoPrev && currentIndex > 0) {
          navigation.navigate(routes[currentIndex - 1].name);
        }
      },
    })
  ).current;

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      {children}
    </View>
  );
};

export default TabSwipeWrapper;
