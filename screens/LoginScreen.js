import { useEffect, useMemo, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppInput from "../components/AppInput";
import AppButton from "../components/AppButton";
import { useApp } from "../contexts/AppContext";
import { BRANCHES, ROLE_LABELS, STUDY_YEARS } from "../services/constants";
import { getTheme } from "../services/theme";

const LoginScreen = () => {
  const { dark, toggleDark, authenticate, requestPasswordReset } = useApp();
  const insets = useSafeAreaInsets();
  const theme = useMemo(() => getTheme(dark), [dark]);

  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("user");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userType, setUserType] = useState("student");
  const [branch, setBranch] = useState(BRANCHES[0]);
  const [year, setYear] = useState(STUDY_YEARS[0]);
  const [usn, setUsn] = useState("");
  const [nickname, setNickname] = useState("");
  const [favoriteSport, setFavoriteSport] = useState("");
  const [forgotName, setForgotName] = useState("");
  const [forgotUserType, setForgotUserType] = useState("student");
  const [forgotUsn, setForgotUsn] = useState("");
  const [forgotNickname, setForgotNickname] = useState("");
  const [forgotFavoriteSport, setForgotFavoriteSport] = useState("");
  const [showForgotForm, setShowForgotForm] = useState(false);
  const [authMsg, setAuthMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const roleOptions = mode === "signup" ? ["user"] : ["user", "admin"];

  useEffect(() => {
    if (mode === "signup" && role === "admin") {
      setRole("user");
    }
  }, [mode, role]);

  const handleSubmit = async () => {
    setLoading(true);
    setAuthMsg("");
    const result = await authenticate({
      mode,
      role,
      name,
      email,
      password,
      userType,
      branch,
      year,
      usn,
      nickname,
      favoriteSport,
    });
    setLoading(false);
    if (!result.ok) setAuthMsg(result.message);
  };

  const handleForgotPassword = async () => {
    setLoading(true);
    setAuthMsg("");
    const result = await requestPasswordReset({
      email,
      name: forgotName,
      usn: forgotUsn,
      userType: forgotUserType,
      nickname: forgotNickname,
      favoriteSport: forgotFavoriteSport,
    });
    setLoading(false);
    setAuthMsg(result.message);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.hero, { paddingTop: Math.max(54, insets.top + 20) }]}>
        <Pressable onPress={toggleDark} style={[styles.darkToggle, { top: Math.max(20, insets.top + 8) }]}>
          <Ionicons name={dark ? "sunny" : "moon"} size={16} color="#FFFFFF" />
        </Pressable>

        <View style={styles.logoWrap}>
          <Image source={require("../assets/app-logo.png")} style={styles.logo} />
        </View>
        <Text style={styles.appTitle}>BMSCE-BUZZ</Text>
        <Text style={styles.appSubtitle}>College News & Announcements Platform</Text>

        <View style={styles.modeSwitchWrap}>
          {[
            { key: "login", label: "Sign In" },
            { key: "signup", label: "Sign Up" },
          ].map((item) => (
            <Pressable
              key={item.key}
              onPress={() => setMode(item.key)}
              style={[styles.modeButton, mode === item.key && styles.modeButtonActive]}
            >
              <Text style={[styles.modeButtonText, mode === item.key && styles.modeButtonTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.formSection}>
        <Text style={[styles.label, { color: theme.text2 }]}>Choose Role</Text>
        <View style={styles.roleGrid}>
          {roleOptions.map((key) => (
            <Pressable
              key={key}
              onPress={() => setRole(key)}
              style={[
                styles.roleCard,
                {
                  borderColor: role === key ? theme.accent : theme.border,
                  backgroundColor: role === key ? `${theme.accent}1F` : theme.card,
                },
              ]}
            >
              <Text style={[styles.roleTitle, { color: role === key ? theme.accent : theme.text }]}>{ROLE_LABELS[key]}</Text>
              <Text style={[styles.roleSubtitle, { color: theme.text2 }]}>
                {key === "user" ? "Student/Faculty" : "Management"}
              </Text>
            </Pressable>
          ))}
        </View>
        {mode === "signup" ? (
          <Text style={[styles.helperText, { color: theme.text3 }]}>
            Admin sign-up is disabled. Only the internal primary admin can sign in.
          </Text>
        ) : null}

        <AppInput
          label="Full Name"
          value={name}
          onChangeText={setName}
          placeholder="Your full name"
          autoCapitalize="words"
          theme={theme}
          style={styles.inputGap}
        />

        <AppInput
          label="College Email"
          value={email}
          onChangeText={setEmail}
          placeholder="yourname@college.edu"
          keyboardType="email-address"
          autoCapitalize="none"
          theme={theme}
          style={styles.inputGap}
        />

        {role === "user" ? (
          <View style={styles.inputGap}>
            <Text style={[styles.label, { color: theme.text2 }]}>I Am</Text>
            <View style={styles.twoCol}>
              {["student", "faculty"].map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setUserType(value)}
                  style={[
                    styles.choiceButton,
                    {
                      borderColor: userType === value ? theme.accent : theme.border,
                      backgroundColor: userType === value ? `${theme.accent}1F` : theme.card,
                    },
                  ]}
                >
                  <Text style={[styles.choiceButtonText, { color: userType === value ? theme.accent : theme.text2 }]}>
                    {value === "student" ? "Student" : "Faculty"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {mode === "signup" && role === "user" ? (
          <>
            <View style={styles.inputGap}>
              <Text style={[styles.label, { color: theme.text2 }]}>Branch</Text>
              <View style={[styles.pickerWrap, { backgroundColor: theme.input, borderColor: theme.border }]}>
                <Picker
                  selectedValue={branch}
                  onValueChange={(value) => setBranch(value)}
                  dropdownIconColor={theme.text2}
                  style={{ color: theme.text }}
                >
                  {BRANCHES.map((item) => (
                    <Picker.Item key={item} label={item} value={item} />
                  ))}
                </Picker>
              </View>
            </View>

            {userType === "student" ? (
              <>
                <View style={styles.inputGap}>
                  <Text style={[styles.label, { color: theme.text2 }]}>Year Of Study</Text>
                  <View style={[styles.pickerWrap, { backgroundColor: theme.input, borderColor: theme.border }]}>
                    <Picker
                      selectedValue={year}
                      onValueChange={(value) => setYear(value)}
                      dropdownIconColor={theme.text2}
                      style={{ color: theme.text }}
                    >
                      {STUDY_YEARS.map((item) => (
                        <Picker.Item key={item} label={item} value={item} />
                      ))}
                    </Picker>
                  </View>
                </View>

                <AppInput
                  label="USN"
                  value={usn}
                  onChangeText={(value) => setUsn(value.toUpperCase())}
                  placeholder="1BM24CS001"
                  autoCapitalize="characters"
                  theme={theme}
                  style={styles.inputGap}
                />
              </>
            ) : null}
          </>
        ) : null}

        {mode === "signup" ? (
          <>
            <AppInput
              label="What Is Your Nickname?"
              value={nickname}
              onChangeText={setNickname}
              placeholder="Enter your nickname"
              autoCapitalize="words"
              theme={theme}
              style={styles.inputGap}
            />

            <AppInput
              label="Which Is Your Favorite Sport?"
              value={favoriteSport}
              onChangeText={setFavoriteSport}
              placeholder="Enter your favorite sport"
              autoCapitalize="words"
              theme={theme}
              style={styles.inputGap}
            />

            <Text style={[styles.passwordRuleText, { color: theme.text3 }]}>
              Password must be 8-10 characters with at least 1 uppercase letter, 1 number, and 1 special character.
            </Text>
          </>
        ) : null}

        <AppInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          placeholder={mode === "signup" ? "Strong password (8-10 chars)" : "Enter password"}
          theme={theme}
          style={styles.inputGap}
        >
          <Pressable onPress={() => setShowPassword((prev) => !prev)} style={styles.passwordToggle}>
            <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={theme.text3} />
          </Pressable>
        </AppInput>

        {mode === "login" ? (
          <>
            <Pressable
              onPress={() => {
                setShowForgotForm((prev) => !prev);
                setAuthMsg("");
              }}
              style={styles.forgotWrap}
            >
              <Text style={[styles.forgotText, { color: theme.accent }]}>
                {showForgotForm ? "Hide forgot password form" : "Forgot password?"}
              </Text>
            </Pressable>

            {showForgotForm ? (
              <View style={[styles.recoveryCard, { borderColor: theme.border, backgroundColor: theme.card }]}>
                <Text style={[styles.recoveryTitle, { color: theme.text }]}>Verify Identity</Text>

                <AppInput
                  label="Full Name"
                  value={forgotName}
                  onChangeText={setForgotName}
                  placeholder="Your registered full name"
                  autoCapitalize="words"
                  theme={theme}
                  style={styles.inputGap}
                />

                <View style={styles.inputGap}>
                  <Text style={[styles.label, { color: theme.text2 }]}>Account Type</Text>
                  <View style={[styles.pickerWrap, { backgroundColor: theme.input, borderColor: theme.border }]}>
                    <Picker
                      selectedValue={forgotUserType}
                      onValueChange={setForgotUserType}
                      dropdownIconColor={theme.text2}
                      style={{ color: theme.text }}
                    >
                      <Picker.Item label="Student" value="student" />
                      <Picker.Item label="Faculty" value="faculty" />
                      <Picker.Item label="Admin" value="admin" />
                    </Picker>
                  </View>
                </View>

                {forgotUserType === "student" ? (
                  <AppInput
                    label="USN"
                    value={forgotUsn}
                    onChangeText={(value) => setForgotUsn(value.toUpperCase())}
                    placeholder="1BM24CS001"
                    autoCapitalize="characters"
                    theme={theme}
                    style={styles.inputGap}
                  />
                ) : null}

                <AppInput
                  label="What Is Your Nickname?"
                  value={forgotNickname}
                  onChangeText={setForgotNickname}
                  placeholder="Nickname answer"
                  autoCapitalize="words"
                  theme={theme}
                  style={styles.inputGap}
                />

                <AppInput
                  label="Which Is Your Favorite Sport?"
                  value={forgotFavoriteSport}
                  onChangeText={setForgotFavoriteSport}
                  placeholder="Favorite sport answer"
                  autoCapitalize="words"
                  theme={theme}
                  style={styles.inputGap}
                />

                <AppButton
                  title={loading ? "Checking..." : "Verify & Show Password"}
                  onPress={handleForgotPassword}
                  disabled={loading}
                  background={theme.accent2}
                  borderColor={theme.accent2}
                />
              </View>
            ) : null}
          </>
        ) : null}

        <AppButton
          title={loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          onPress={handleSubmit}
          disabled={loading}
          background={theme.accent}
          borderColor={theme.accent}
        />

        {authMsg ? <Text style={[styles.authMsg, { color: theme.accent }]}>{authMsg}</Text> : null}

        <View style={[styles.securityCard, { borderColor: `${theme.accent}55`, backgroundColor: `${theme.accent}14` }]}>
          <Ionicons name="shield-checkmark" size={18} color={theme.accent} />
          <Text style={[styles.securityText, { color: theme.text2 }]}>Secured with strong encryption and protected auth flows.</Text>
        </View>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  hero: {
    backgroundColor: "#0F2040",
    paddingTop: 54,
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: "center",
    position: "relative",
  },
  darkToggle: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  logoWrap: {
    width: 70,
    height: 70,
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: 14,
    backgroundColor: "#F59E0B",
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  appTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  appSubtitle: {
    marginTop: 4,
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 22,
  },
  modeSwitchWrap: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 12,
    padding: 4,
    width: "100%",
    maxWidth: 260,
  },
  modeButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    minHeight: 34,
  },
  modeButtonActive: {
    backgroundColor: "#FFFFFF",
  },
  modeButtonText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontWeight: "800",
  },
  modeButtonTextActive: {
    color: "#0A1628",
  },
  formSection: {
    paddingHorizontal: 18,
    paddingTop: 20,
    gap: 0,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  roleGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  roleCard: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  roleTitle: {
    fontSize: 12,
    fontWeight: "900",
  },
  roleSubtitle: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  inputGap: {
    marginBottom: 14,
  },
  passwordRuleText: {
    marginTop: -4,
    marginBottom: 12,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "500",
  },
  helperText: {
    marginTop: -2,
    marginBottom: 12,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "500",
  },
  passwordToggle: {
    paddingLeft: 10,
    paddingVertical: 6,
  },
  twoCol: {
    flexDirection: "row",
    gap: 8,
  },
  choiceButton: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceButtonText: {
    fontSize: 12,
    fontWeight: "800",
  },
  pickerWrap: {
    borderWidth: 1.5,
    borderRadius: 12,
    overflow: "hidden",
    minHeight: 48,
    justifyContent: "center",
  },
  forgotWrap: {
    alignSelf: "flex-end",
    marginTop: -8,
    marginBottom: 14,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: "700",
  },
  recoveryCard: {
    marginBottom: 14,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
  },
  recoveryTitle: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 10,
  },
  authMsg: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "700",
  },
  securityCard: {
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  securityText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "500",
  },
});

export default LoginScreen;
