import { Pressable, StyleSheet, Text } from "react-native";

const AppButton = ({
  title,
  onPress,
  background,
  color = "#FFFFFF",
  outline = false,
  borderColor = "transparent",
  disabled = false,
  style,
  textStyle,
}) => {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: outline ? "transparent" : background || "#F59E0B",
          borderColor,
          opacity: disabled ? 0.6 : pressed ? 0.9 : 1,
        },
        style,
      ]}
    >
      <Text style={[styles.text, { color }, textStyle]}>{title}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1.5,
  },
  text: {
    fontSize: 14,
    fontWeight: "800",
  },
});

export default AppButton;
