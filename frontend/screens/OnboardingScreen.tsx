import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Linking,
  TextInput,
  TouchableOpacity,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { useUser } from "../components/UserContext";
import { useNavigation } from "@react-navigation/native";
import React, { useState, useEffect, useRef } from "react";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";

const SOCIAL_KEYS = [
  "instagram",
  "snapchat",
  "spotify",
  "linkedin",
  "github",
] as const;
type SocialKey = (typeof SOCIAL_KEYS)[number];

const SOCIAL_URLS: Partial<Record<SocialKey, string>> = {
  instagram: "https://instagram.com/",
  linkedin: "https://linkedin.com/in/",
  github: "https://github.com/",
  spotify: "https://open.spotify.com/user/",
};

interface EditData {
  username: string;
  first_name: string;
  last_name: string;
  hometown: string;
  school: string;
  job: string;
  interests: string[];
  links: { [K in SocialKey]: string };
  profile_picture?: string;
}

export default function OnboardingScreen() {
  const navigation = useNavigation();
  const { user, setUser } = useUser();
  const [editData, setEditData] = useState<EditData | null>(null);
  const [loading, setLoading] = useState(false);
  const [interestInput, setInterestInput] = useState("");
  const interestInputRef = useRef<TextInput>(null);
  const [addedSocials, setAddedSocials] = useState<SocialKey[]>([]);
  const [showSocialPicker, setShowSocialPicker] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      const presentSocials = SOCIAL_KEYS.filter((k) => user.links?.[k]);
      setAddedSocials(presentSocials);
      setEditData({
        username: user.username || "",
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        hometown: user.hometown || "",
        school: user.school || "",
        job: user.job || "",
        interests: Array.isArray(user.interests) ? user.interests : [],
        links: {
          instagram: user.links?.instagram || "",
          snapchat: user.links?.snapchat || "",
          spotify: user.links?.spotify || "",
          linkedin: user.links?.linkedin || "",
          github: user.links?.github || "",
        },
        profile_picture: user.profile_picture || "",
      });
      setProfileImage(user.profile_picture || null);
      setInterestInput("");
    }
  }, [user]);

  if (!user || !editData) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.text}>No user info available.</Text>
      </View>
    );
  }

  const requestPermission = async () => {
    try {
      // This will show the system permission dialog
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      return status === "granted";
    } catch (error) {
      console.error("Error requesting permission:", error);
      return false;
    }
  };

  const pickImage = async () => {
    try {
      // Request permission first
      const permissionGranted = await requestPermission();

      if (!permissionGranted) {
        // If permission denied, show a simple alert with retry option
        Alert.alert(
          "Permission Required",
          "We need access to your photos to set a profile picture.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Try Again", onPress: pickImage },
          ]
        );
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        const imageUri = result.assets[0].uri;
        setProfileImage(imageUri);

        // Update editData with the new profile picture
        if (editData) {
          setEditData({
            ...editData,
            profile_picture: imageUri,
          });
        }
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to access photo library. Please try again.");
    }
  };

  const handleChange = (
    field: keyof Omit<EditData, "interests" | "links" | "profile_picture">,
    value: string
  ) => {
    setEditData({ ...editData, [field]: value });
  };

  const handleSocialChange = (key: SocialKey, value: string) => {
    setEditData({ ...editData, links: { ...editData.links, [key]: value } });
  };

  const handleAddInterest = () => {
    const trimmed = interestInput.trim();
    if (trimmed && !editData.interests.includes(trimmed)) {
      setEditData({ ...editData, interests: [...editData.interests, trimmed] });
    }
    setInterestInput("");
    Keyboard.dismiss();
  };

  const handleRemoveInterest = (interest: string) => {
    setEditData({
      ...editData,
      interests: editData.interests.filter((i) => i !== interest),
    });
  };

  const handleSkip = () => {
    // Navigate to the main app
    navigation.navigate("Main" as never);
  };

  const handleSave = async () => {
    setLoading(true);
    // Only send non-empty links, and for IG/LinkedIn/GitHub, prepend the starter if not empty
    const links: { [K in SocialKey]?: string } = {};
    SOCIAL_KEYS.forEach((k) => {
      const val = editData.links[k];
      if (val) {
        if (SOCIAL_URLS[k]) {
          // Only add if not already a full URL
          links[k] = val.startsWith("http")
            ? val
            : SOCIAL_URLS[k]! + val.replace(/^\/+/, "");
        } else {
          links[k] = val;
        }
      }
    });
    const payload = {
      username: editData.username,
      first_name: editData.first_name,
      last_name: editData.last_name,
      hometown: editData.hometown,
      school: editData.school,
      job: editData.job,
      interests: editData.interests,
      links,
      profile_picture: profileImage,
    };
    try {
      const response = await fetch(`http://10.0.0.64:8000/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Failed to update profile");
      }
      const updatedUser = await response.json();
      setUser(updatedUser);

      // Navigate to the main app
      navigation.navigate("Main" as never);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleAddSocial = (key: SocialKey) => {
    setAddedSocials([...addedSocials, key]);
    setShowSocialPicker(false);
  };

  const handleRemoveSocial = (key: SocialKey) => {
    setAddedSocials(addedSocials.filter((k) => k !== key));
    setEditData({
      ...editData,
      links: { ...editData.links, [key]: "" },
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.profileCard}>
          <Text style={styles.title}>Tell us about you!</Text>
          <Text style={styles.subtitle}>
            Help others get to know you better. You can always update this
            information later.
          </Text>

          {/* Profile Picture Section */}
          <TouchableOpacity
            style={styles.profilePictureSection}
            onPress={pickImage}
            activeOpacity={0.8}
          >
            <View style={styles.profileImageContainer}>
              {profileImage ? (
                <Image
                  source={{ uri: profileImage }}
                  style={styles.profileImage}
                />
              ) : (
                <View style={styles.profilePlaceholder}>
                  <Text style={styles.initialsText}>
                    {editData?.first_name &&
                      editData?.first_name.charAt(0).toUpperCase()}
                    {editData?.last_name &&
                      editData?.last_name.charAt(0).toUpperCase()}
                    {!editData?.first_name && !editData?.last_name && "?"}
                  </Text>
                </View>
              )}
              <View style={styles.editIconContainer}>
                {/* Camera icon removed */}
              </View>
            </View>
            <Text style={styles.profilePictureText}>
              {profileImage ? "Change Profile Picture" : "Add Profile Picture"}
            </Text>
          </TouchableOpacity>

          <View style={styles.section}>
            <Text style={styles.label}>Hometown</Text>
            <TextInput
              style={styles.input}
              value={editData.hometown}
              onChangeText={(v) => handleChange("hometown", v)}
              placeholder="Where are you from?"
            />
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>School</Text>
            <TextInput
              style={styles.input}
              value={editData.school}
              onChangeText={(v) => handleChange("school", v)}
              placeholder="Where do/did you go to school?"
            />
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>Job</Text>
            <TextInput
              style={styles.input}
              value={editData.job}
              onChangeText={(v) => handleChange("job", v)}
              placeholder="What do you do?"
            />
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>Interests</Text>
            <View style={styles.interestInputRow}>
              <TextInput
                ref={interestInputRef}
                style={[styles.input, { flex: 1, marginRight: 8 }]}
                value={interestInput}
                onChangeText={setInterestInput}
                placeholder="Type an interest and press enter"
                onSubmitEditing={handleAddInterest}
                blurOnSubmit={false}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={styles.addInterestButton}
                onPress={handleAddInterest}
              >
                <Text style={styles.addInterestButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.interestsBubbleRow}>
              {editData.interests.map((interest) => (
                <View key={interest} style={styles.interestBubble}>
                  <Text style={styles.interestText}>{interest}</Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveInterest(interest)}
                  >
                    <Text style={styles.removeInterest}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>Social Links</Text>
            {addedSocials.map((key) => (
              <View
                key={key}
                style={{
                  width: "100%",
                  marginBottom: 8,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Text style={styles.socialLabel}>
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </Text>
                <TextInput
                  style={[styles.input, { flex: 1, marginLeft: 8 }]}
                  value={editData.links[key]}
                  onChangeText={(v) => handleSocialChange(key, v)}
                  placeholder={`Enter your ${key} handle or link`}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => handleRemoveSocial(key)}
                  style={styles.removeSocialButton}
                >
                  <Text style={styles.removeInterest}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
            {showSocialPicker ? (
              <View style={styles.socialPickerContainer}>
                {SOCIAL_KEYS.filter((k) => !addedSocials.includes(k)).map(
                  (key) => (
                    <TouchableOpacity
                      key={key}
                      style={styles.socialPickerOption}
                      onPress={() => handleAddSocial(key)}
                    >
                      <Text style={styles.socialPickerText}>
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
                <TouchableOpacity
                  style={styles.socialPickerCancel}
                  onPress={() => setShowSocialPicker(false)}
                >
                  <Text style={styles.socialPickerCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              addedSocials.length < SOCIAL_KEYS.length && (
                <TouchableOpacity
                  style={styles.addSocialButton}
                  onPress={() => setShowSocialPicker(true)}
                >
                  <Text style={styles.addInterestButtonText}>Add Link</Text>
                </TouchableOpacity>
              )
            )}
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.saveButton,
                loading && styles.disabledButton,
              ]}
              onPress={handleSave}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? "Saving..." : "Continue"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.skipButton]}
              onPress={handleSkip}
              disabled={loading}
            >
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    minHeight: "100%",
    backgroundColor: "#f5f6fa",
    paddingTop: 80,
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: "#f5f6fa",
    alignItems: "center",
    justifyContent: "center",
  },
  profileCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#007AFF",
    marginBottom: 12,
    textAlign: "left",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 24,
    lineHeight: 22,
  },
  section: {
    marginBottom: 16,
    alignItems: "flex-start",
    width: "100%",
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#888",
    marginBottom: 2,
    textAlign: "left",
  },
  socialLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
    marginLeft: 2,
  },
  value: {
    fontSize: 17,
    color: "#222",
    marginBottom: 2,
    textAlign: "left",
  },
  input: {
    width: "100%",
    fontSize: 17,
    color: "#222",
    backgroundColor: "#f0f4f8",
    borderRadius: 8,
    padding: 10,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  interestInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    width: "100%",
  },
  addInterestButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  addInterestButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  interestsBubbleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
    width: "100%",
  },
  interestBubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e0e7ef",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  interestText: {
    fontSize: 15,
    color: "#333",
    marginRight: 6,
  },
  removeInterest: {
    color: "#888",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 2,
    marginTop: -2,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    width: "100%",
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  saveButton: {
    backgroundColor: "#007AFF",
    marginRight: 8,
  },
  skipButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#007AFF",
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  skipButtonText: {
    color: "#007AFF",
    fontWeight: "600",
    fontSize: 16,
  },
  text: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#888",
  },
  socialInputRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  socialUrlStarter: {
    fontSize: 15,
    color: "#888",
    marginRight: 2,
  },
  removeSocialButton: {
    padding: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  socialPickerContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
    width: "100%",
  },
  socialPickerOption: {
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  socialPickerText: {
    fontSize: 15,
    color: "#333",
  },
  socialPickerCancel: {
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  socialPickerCancelText: {
    fontSize: 15,
    color: "#333",
  },
  addSocialButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  profilePictureSection: {
    alignItems: "center",
    marginBottom: 24,
    width: "100%",
  },
  profileImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#f0f4f8",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    overflow: "hidden",
  },
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: 60,
  },
  profilePlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#007AFF",
  },
  editIconContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  profilePictureText: {
    fontSize: 16,
    color: "#007AFF",
    marginTop: 8,
  },
  initialsText: {
    fontSize: 40,
    fontWeight: "bold",
    color: "#fff",
  },
});
