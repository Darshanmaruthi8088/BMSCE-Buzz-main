import { StyleSheet, Text, TextInput, View } from "react-native";

const AppInput = ({
  label,
  value,
  onChangeText,
  placeholder,
  theme,
  secureTextEntry,
  keyboardType,
  multiline,
  numberOfLines,
  autoCapitalize = "none",
  editable = true,
  style,
  inputStyle,
  children,
}) => {
  return (
    <View style={[styles.wrapper, style]}>
      {label ? <Text style={[styles.label, { color: theme.text2 }]}>{label}</Text> : null}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.input,
            borderColor: theme.border,
          },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.text3}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={numberOfLines}
          autoCapitalize={autoCapitalize}
          editable={editable}
          style={[styles.input, { color: theme.text }, inputStyle]}
        />
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputContainer: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    justifyContent: "center",
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    paddingVertical: 10,
  },
});

export default AppInput;
