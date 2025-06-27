import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
} from "react-native";
import { useUser } from "../components/UserContext";
import { Ionicons } from "@expo/vector-icons";
import * as Contacts from "expo-contacts";
import { useNavigation, useIsFocused } from "@react-navigation/native";

// API base URL - must match the one used in other components
const API_URL = "http://10.0.0.64:8000";

interface Friend {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  friendship_id?: number;
}

interface ContactMatch {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  phone_number: string;
  is_registered: boolean;
}

export default function FriendsScreen() {
  const { user, checkContacts } = useUser();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([]);
  const [sentRequests, setSentRequests] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactMatches, setContactMatches] = useState<ContactMatch[]>([]);
  const [contactsPermissionGranted, setContactsPermissionGranted] = useState<
    boolean | null
  >(null);
  const [isLocalSearch, setIsLocalSearch] = useState(false);
  const [showAllContacts, setShowAllContacts] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState("");
  const isFirstFocus = useRef(true);
  const isFocused = useIsFocused();

  // Fetch user's friends when component mounts
  useEffect(() => {
    if (user) {
      fetchFriends();
      fetchFriendRequests();
      fetchSentRequests();
      checkContactsPermission();
    }
  }, [user]);

  // Auto refresh when screen comes into focus
  useEffect(() => {
    // Skip if this is the first focus or if the screen is not focused
    if (!isFocused || isFirstFocus.current) {
      if (isFocused) {
        isFirstFocus.current = false;
      }
      return;
    }

    if (user) {
      console.log("FriendsScreen focused - refreshing data");

      // Use the refreshContactsQuietly function which now handles all updates
      if (contactsPermissionGranted) {
        console.log("Auto-refreshing all data including contacts");
        refreshContactsQuietly();
      } else {
        // If no contacts permission, just update the other lists
        fetchFriends();
        fetchFriendRequests();
        fetchSentRequests();
      }
    }
  }, [user, isFocused, contactsPermissionGranted]);

  // Check if contacts permission is already granted
  const checkContactsPermission = async () => {
    try {
      const { status } = await Contacts.getPermissionsAsync();
      setContactsPermissionGranted(status === "granted");
    } catch (error) {
      console.error("Error checking contacts permission:", error);
      setContactsPermissionGranted(false);
    }
  };

  const fetchFriends = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/users/${user.id}/friends`);

      if (response.ok) {
        const data = await response.json();
        setFriends(data);
      } else {
        console.error("Failed to fetch friends:", response.status);
        // If the endpoint doesn't exist yet, use empty array
        setFriends([]);
      }
    } catch (error) {
      console.error("Error fetching friends:", error);
      setFriends([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchFriendRequests = async () => {
    if (!user) return;

    try {
      setLoadingRequests(true);
      const response = await fetch(
        `${API_URL}/users/${user.id}/friend-requests`
      );

      if (response.ok) {
        const data = await response.json();
        setPendingRequests(data);
      } else {
        console.error("Failed to fetch friend requests:", response.status);
        setPendingRequests([]);
      }
    } catch (error) {
      console.error("Error fetching friend requests:", error);
      setPendingRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  };

  const fetchSentRequests = async () => {
    if (!user) return;

    try {
      const response = await fetch(
        `${API_URL}/users/${user.id}/sent-friend-requests`
      );

      if (response.ok) {
        const data = await response.json();
        setSentRequests(data);
      } else {
        console.error("Failed to fetch sent requests:", response.status);
        setSentRequests([]);
      }
    } catch (error) {
      console.error("Error fetching sent requests:", error);
      setSentRequests([]);
    }
  };

  const syncContacts = async () => {
    try {
      setLoadingContacts(true);
      const { status } = await Contacts.requestPermissionsAsync();

      setContactsPermissionGranted(status === "granted");

      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "To find friends from your contacts, please enable contacts access in settings."
        );
        setLoadingContacts(false);
        return;
      }

      await loadContactMatches();
    } catch (error) {
      console.error("Error syncing contacts:", error);
      Alert.alert("Error", "Failed to sync contacts. Please try again.");
    } finally {
      setLoadingContacts(false);
    }
  };

  const refreshContacts = async () => {
    if (!contactsPermissionGranted) {
      syncContacts();
      return;
    }

    try {
      setLoadingContacts(true);

      // Don't clear existing contacts, just refresh to check for new ones
      await loadContactMatches();
    } catch (error) {
      console.error("Error refreshing contacts:", error);
      Alert.alert("Error", "Failed to refresh contacts. Please try again.");
    } finally {
      setLoadingContacts(false);
    }
  };

  // Silent refresh without UI indicators or alerts
  const refreshContactsQuietly = async () => {
    if (!contactsPermissionGranted) return;

    try {
      console.log("Starting silent refresh of contacts");

      // First, make sure our friends list is up-to-date
      await fetchFriends();
      await fetchFriendRequests();
      await fetchSentRequests();

      console.log("Lists updated, now filtering contacts");

      // Then update contacts with the latest data
      await updateContactMatches();
    } catch (error) {
      console.error("Error silently refreshing contacts:", error);
      // No alerts for silent refresh
    }
  };

  const loadContactMatches = async () => {
    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });

      if (data.length > 0) {
        console.log(`Found ${data.length} contacts on device`);

        // Extract phone numbers
        const phoneNumbers = data
          .filter(
            (contact) => contact.phoneNumbers && contact.phoneNumbers.length > 0
          )
          .map((contact) => {
            const rawNumber = contact.phoneNumbers![0].number!;
            console.log(`Contact ${contact.name}: ${rawNumber}`);
            return rawNumber;
          });

        console.log(`Checking ${phoneNumbers.length} contacts against server`);

        // Check which contacts are registered users
        const contactsResult = await checkContacts(phoneNumbers);

        console.log(
          "Server response:",
          JSON.stringify(contactsResult, null, 2)
        );

        // Format results
        const matches: ContactMatch[] = [];
        for (const [phone, userData] of Object.entries(contactsResult)) {
          const userInfo = userData as any;
          if (userInfo.is_registered && userInfo.id !== user?.id) {
            console.log(
              `Found registered user: ${userInfo.username} (${phone})`
            );

            // Skip users who are already friends
            if (friends.some((friend) => friend.id === userInfo.id)) {
              console.log(`Skipping ${userInfo.username} - already a friend`);
              continue;
            }

            // Skip users who have incoming friend requests
            if (pendingRequests.some((request) => request.id === userInfo.id)) {
              console.log(
                `Skipping ${userInfo.username} - has pending request`
              );
              continue;
            }

            // Check if there's a sent request to this user
            const hasSentRequest = sentRequests.some(
              (request) => request.id === userInfo.id
            );

            // If there's a sent request, skip this user
            if (hasSentRequest) {
              console.log(
                `Skipping ${userInfo.username} - already sent a request`
              );
              continue;
            }

            // Include the user in matches
            matches.push({
              id: userInfo.id,
              username: userInfo.username,
              first_name: userInfo.first_name,
              last_name: userInfo.last_name,
              phone_number: phone,
              is_registered: true,
            });
          }
        }

        // Replace existing contacts with new filtered list
        if (matches.length > 0) {
          setContactMatches(matches);
          console.log(`Found ${matches.length} new contact matches`);
          Alert.alert(
            "Contacts Synced",
            `Found ${matches.length} contacts using the app!`
          );
        } else {
          setContactMatches([]);
          console.log("No new contact matches found");
          Alert.alert(
            "No Available Contacts",
            "None of your contacts are using the app, or they are already your friends or have pending requests."
          );
        }
      } else {
        Alert.alert("No Contacts", "No contacts found on your device.");
      }
    } catch (error) {
      console.error("Error loading contacts:", error);
      throw error;
    }
  };

  // Silent version of loadContactMatches that doesn't show alerts
  const updateContactMatches = async () => {
    try {
      if (!contactsPermissionGranted) return;

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });

      if (data.length > 0) {
        console.log(
          `Found ${data.length} contacts on device for silent refresh`
        );

        // Extract phone numbers
        const phoneNumbers = data
          .filter(
            (contact) => contact.phoneNumbers && contact.phoneNumbers.length > 0
          )
          .map((contact) => {
            const rawNumber = contact.phoneNumbers![0].number!;
            return rawNumber;
          });

        // Check which contacts are registered users
        const contactsResult = await checkContacts(phoneNumbers);

        // Format results
        const matches: ContactMatch[] = [];
        for (const [phone, userData] of Object.entries(contactsResult)) {
          const userInfo = userData as any;
          if (userInfo.is_registered && userInfo.id !== user?.id) {
            // Skip users who are already friends
            if (friends.some((friend) => friend.id === userInfo.id)) {
              console.log(`Skipping ${userInfo.username} - already a friend`);
              continue;
            }

            // Skip users who have incoming friend requests
            if (pendingRequests.some((request) => request.id === userInfo.id)) {
              console.log(
                `Skipping ${userInfo.username} - has pending request`
              );
              continue;
            }

            // Check if there's a sent request to this user
            const hasSentRequest = sentRequests.some(
              (request) => request.id === userInfo.id
            );

            // If there's a sent request, skip this user
            if (hasSentRequest) {
              console.log(
                `Skipping ${userInfo.username} - already sent a request`
              );
              continue;
            }

            // Include the user in matches
            matches.push({
              id: userInfo.id,
              username: userInfo.username,
              first_name: userInfo.first_name,
              last_name: userInfo.last_name,
              phone_number: phone,
              is_registered: true,
            });
          }
        }

        // Replace existing contacts with new filtered list
        setContactMatches(matches);
        console.log(`Found ${matches.length} contacts in silent refresh`);
      }
    } catch (error) {
      console.error("Error updating contacts silently:", error);
    }
  };

  // Filter function for local search
  const filterBySearchQuery = (item: Friend | ContactMatch) => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const fullName =
      item.first_name && item.last_name
        ? `${item.first_name} ${item.last_name}`.toLowerCase()
        : "";

    return (
      item.username.toLowerCase().includes(query) ||
      fullName.includes(query) ||
      (item.first_name && item.first_name.toLowerCase().includes(query)) ||
      (item.last_name && item.last_name.toLowerCase().includes(query))
    );
  };

  // Filtered lists
  const filteredFriends = useMemo(() => {
    return friends.filter(filterBySearchQuery);
  }, [friends, searchQuery]);

  const filteredPendingRequests = useMemo(() => {
    return pendingRequests.filter(filterBySearchQuery);
  }, [pendingRequests, searchQuery]);

  const filteredContactMatches = useMemo(() => {
    return contactMatches.filter(filterBySearchQuery);
  }, [contactMatches, searchQuery]);

  // Handle search input change
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    setIsLocalSearch(!!text.trim());
  };

  // Search function - just handles local filtering
  const searchUsers = () => {
    // Nothing to do here - filtering is handled by the useMemo hooks
  };

  const addFriend = async (friendId: number) => {
    if (!user) return;

    try {
      const response = await fetch(`${API_URL}/users/${user.id}/friends`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ friend_id: friendId }),
      });

      if (response.ok) {
        // Add the user to sent requests locally
        const friendToAdd = contactMatches.find((item) => item.id === friendId);

        if (friendToAdd) {
          setSentRequests((prev) => [...prev, friendToAdd as Friend]);
        }

        // Remove the contact from the matches list since they now have a pending request
        setContactMatches(
          contactMatches.filter((match) => match.id !== friendId)
        );

        Alert.alert("Friend Request Sent", "Friend request sent successfully!");
      } else {
        const errorData = await response.text();
        console.error("Failed to add friend:", response.status, errorData);

        // Check if the error is because friendship already exists
        if (errorData.includes("Friendship already exists")) {
          Alert.alert(
            "Already Friends",
            "You already have a pending or accepted friendship with this user."
          );
          // Refresh lists to make sure UI is in sync
          fetchFriends();
          fetchFriendRequests();
          fetchSentRequests();

          // Also refresh contacts to remove this user from the list
          if (contactsPermissionGranted) {
            updateContactMatches();
          }
        } else if (errorData.includes("User not found")) {
          Alert.alert(
            "User Not Found",
            "The user you're trying to add doesn't exist or has been deleted."
          );
        } else {
          Alert.alert("Error", `Failed to add friend: ${errorData}`);
        }
      }
    } catch (error) {
      console.error("Error adding friend:", error);
      Alert.alert("Error", "An error occurred while adding friend.");
    }
  };

  const acceptFriendRequest = async (friendshipId: number) => {
    if (!user) return;

    try {
      const response = await fetch(
        `${API_URL}/users/${user.id}/friend-requests/${friendshipId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ is_accepted: true }),
        }
      );

      if (response.ok) {
        // Get the accepted friend before refreshing lists
        const acceptedFriend = pendingRequests.find(
          (request) => request.friendship_id === friendshipId
        );

        // Refresh all lists
        await fetchFriends();
        await fetchFriendRequests();
        await fetchSentRequests();

        // Remove the accepted friend from contacts list immediately
        if (acceptedFriend) {
          console.log(
            `Removing accepted friend ${acceptedFriend.username} from contacts`
          );
          setContactMatches((prevContacts) =>
            prevContacts.filter((contact) => contact.id !== acceptedFriend.id)
          );
        }

        // Update contacts to ensure consistency
        if (contactsPermissionGranted) {
          updateContactMatches();
        }

        Alert.alert("Success", "Friend request accepted!");
      } else {
        const errorData = await response.text();
        console.error(
          "Failed to accept friend request:",
          response.status,
          errorData
        );
        Alert.alert(
          "Error",
          "Failed to accept friend request. Please try again."
        );
      }
    } catch (error) {
      console.error("Error accepting friend request:", error);
      Alert.alert("Error", "An error occurred while accepting friend request.");
    }
  };

  const rejectFriendRequest = async (friendshipId: number) => {
    if (!user) return;

    try {
      const response = await fetch(
        `${API_URL}/users/${user.id}/friend-requests/${friendshipId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ is_accepted: false }),
        }
      );

      if (response.ok) {
        fetchFriendRequests();

        // Silently update contacts without alerts
        if (contactsPermissionGranted) {
          updateContactMatches();
        }

        Alert.alert("Success", "Friend request rejected.");
      } else {
        const errorData = await response.text();
        console.error(
          "Failed to reject friend request:",
          response.status,
          errorData
        );
        Alert.alert(
          "Error",
          "Failed to reject friend request. Please try again."
        );
      }
    } catch (error) {
      console.error("Error rejecting friend request:", error);
      Alert.alert("Error", "An error occurred while rejecting friend request.");
    }
  };

  // Render a friend item without the FlatList
  const renderFriendItemInline = (item: Friend, index: number) => (
    <View style={styles.friendItem} key={`inline-friend-${item.id}`}>
      <View style={styles.friendAvatar}>
        <Text style={styles.avatarText}>
          {item.first_name?.[0] || item.username[0].toUpperCase()}
        </Text>
      </View>
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>
          {item.first_name && item.last_name
            ? `${item.first_name} ${item.last_name}`
            : item.username}
        </Text>
        <Text style={styles.friendUsername}>@{item.username}</Text>
      </View>
    </View>
  );

  const renderContactMatch = ({ item }: { item: ContactMatch }) => (
    <View style={styles.searchResultItem}>
      <View style={styles.friendAvatar}>
        <Text style={styles.avatarText}>
          {item.first_name?.[0] || item.username[0].toUpperCase()}
        </Text>
      </View>
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>
          {item.first_name && item.last_name
            ? `${item.first_name} ${item.last_name}`
            : item.username}
        </Text>
        <Text style={styles.friendUsername}>@{item.username}</Text>
      </View>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => addFriend(item.id)}
      >
        <Ionicons name="add-circle" size={24} color="#007AFF" />
      </TouchableOpacity>
    </View>
  );

  const renderFriendRequestItem = ({ item }: { item: Friend }) => (
    <View style={styles.friendRequestItem}>
      <View style={styles.friendAvatar}>
        <Text style={styles.avatarText}>
          {item.first_name?.[0] || item.username[0].toUpperCase()}
        </Text>
      </View>
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>
          {item.first_name && item.last_name
            ? `${item.first_name} ${item.last_name}`
            : item.username}
        </Text>
        <Text style={styles.friendUsername}>@{item.username}</Text>
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() =>
            item.friendship_id && acceptFriendRequest(item.friendship_id)
          }
        >
          <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.rejectButton}
          onPress={() =>
            item.friendship_id && rejectFriendRequest(item.friendship_id)
          }
        >
          <Ionicons name="close-circle" size={24} color="#F44336" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <Text style={styles.title}>Friends</Text>

      <View style={styles.actionsContainer}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for users..."
            value={searchQuery}
            onChangeText={handleSearchChange}
            onSubmitEditing={searchUsers}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => handleSearchChange("")}
            >
              <Ionicons name="close-circle" size={18} color="#999" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.searchButton} onPress={searchUsers}>
            <Ionicons name="search" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {contactsPermissionGranted === false && (
          <TouchableOpacity
            style={styles.syncButton}
            onPress={syncContacts}
            disabled={loadingContacts}
          >
            {loadingContacts ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons
                  name="people"
                  size={18}
                  color="#fff"
                  style={styles.syncIcon}
                />
                <Text style={styles.syncButtonText}>Sync Contacts</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {contactsPermissionGranted === true && (
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={refreshContacts}
            disabled={loadingContacts}
          >
            {loadingContacts ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons
                  name="refresh"
                  size={18}
                  color="#fff"
                  style={styles.syncIcon}
                />
                <Text style={styles.syncButtonText}>Refresh Contacts</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {contactMatches.length > 0 &&
        (!isLocalSearch || filteredContactMatches.length > 0) && (
          <View style={styles.contactsContainer}>
            <Text style={styles.sectionTitle}>From Your Contacts</Text>
            <View>
              {(isLocalSearch ? filteredContactMatches : contactMatches)
                .slice(0, 3) // Limit to 3 profiles
                .map((item) => (
                  <View key={`contact-${item.id}`}>
                    {renderContactMatch({ item })}
                  </View>
                ))}
              {(isLocalSearch ? filteredContactMatches : contactMatches)
                .length > 3 && (
                <TouchableOpacity
                  style={styles.showMoreButton}
                  onPress={() => {
                    setModalSearchQuery("");
                    setShowAllContacts(true);
                  }}
                >
                  <Text style={styles.showMoreText}>
                    Show{" "}
                    {(isLocalSearch ? filteredContactMatches : contactMatches)
                      .length - 3}{" "}
                    more
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

      {pendingRequests.length > 0 &&
        (!isLocalSearch || filteredPendingRequests.length > 0) && (
          <View style={styles.requestsContainer}>
            <Text style={styles.sectionTitle}>Friend Requests</Text>
            <View>
              {(isLocalSearch ? filteredPendingRequests : pendingRequests).map(
                (item) => (
                  <View key={`request-${item.id}`}>
                    {renderFriendRequestItem({ item })}
                  </View>
                )
              )}
            </View>
          </View>
        )}

      <Text style={styles.sectionTitle}>My Friends</Text>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#007AFF" />
      ) : friends.length > 0 ? (
        isLocalSearch && filteredFriends.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search" size={60} color="#ccc" />
            <Text style={styles.emptyStateText}>
              No friends match your search
            </Text>
            <Text style={styles.emptyStateSubtext}>
              Try a different search term
            </Text>
          </View>
        ) : (
          <View style={styles.friendsListContainer}>
            {(isLocalSearch ? filteredFriends : friends).map(
              renderFriendItemInline
            )}
          </View>
        )
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={60} color="#ccc" />
          <Text style={styles.emptyStateText}>
            You don't have any friends yet.
          </Text>
          <Text style={styles.emptyStateSubtext}>
            Search for users or sync your contacts to find friends.
          </Text>
        </View>
      )}

      {/* Modal for showing all contacts */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={showAllContacts}
        onRequestClose={() => {
          setModalSearchQuery("");
          setShowAllContacts(false);
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>All Contacts</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setModalSearchQuery("");
                setShowAllContacts(false);
              }}
            >
              <Ionicons name="close" size={28} color="#007AFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalSearchContainer}>
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search contacts..."
              value={modalSearchQuery}
              onChangeText={setModalSearchQuery}
            />
            {modalSearchQuery.length > 0 && (
              <TouchableOpacity
                style={styles.modalClearButton}
                onPress={() => setModalSearchQuery("")}
              >
                <Ionicons name="close-circle" size={18} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={styles.modalContent}>
            {contactMatches
              .filter((contact) => {
                if (!modalSearchQuery) return true;

                const query = modalSearchQuery.toLowerCase();
                const fullName =
                  contact.first_name && contact.last_name
                    ? `${contact.first_name} ${contact.last_name}`.toLowerCase()
                    : "";

                return (
                  contact.username.toLowerCase().includes(query) ||
                  fullName.includes(query) ||
                  (contact.first_name &&
                    contact.first_name.toLowerCase().includes(query)) ||
                  (contact.last_name &&
                    contact.last_name.toLowerCase().includes(query))
                );
              })
              .map((item) => (
                <View key={`modal-contact-${item.id}`}>
                  {renderContactMatch({ item })}
                </View>
              ))}
            {contactMatches.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No contacts found</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  contentContainer: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#007AFF",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 5,
    marginBottom: 8,
  },
  actionsContainer: {
    marginBottom: 15,
  },
  searchContainer: {
    flexDirection: "row",
    marginBottom: 10,
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    height: 45,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingRight: 35,
    backgroundColor: "white",
  },
  searchButton: {
    width: 45,
    height: 45,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    marginLeft: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  syncButton: {
    height: 45,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 15,
  },
  refreshButton: {
    height: 45,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 15,
  },
  syncButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  syncIcon: {
    marginRight: 8,
  },
  friendsListContainer: {
    width: "100%",
  },
  friendItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  friendAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  avatarText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: "600",
  },
  friendUsername: {
    fontSize: 14,
    color: "#666",
  },
  loader: {
    marginVertical: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 50,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 20,
    color: "#555",
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#888",
    marginTop: 10,
    textAlign: "center",
  },
  searchResultsContainer: {
    marginBottom: 20,
  },
  searchResultsList: {
    maxHeight: 200,
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  addButton: {
    padding: 5,
  },
  contactsContainer: {
    marginBottom: 15,
  },
  contactsList: {
    backgroundColor: "#fff",
  },
  loadingContactsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
  },
  loadingText: {
    marginLeft: 10,
    color: "#666",
  },
  requestsContainer: {
    marginBottom: 15,
  },
  requestsList: {
    backgroundColor: "#fff",
  },
  friendRequestItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  requestActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  acceptButton: {
    padding: 5,
    marginRight: 10,
  },
  rejectButton: {
    padding: 5,
  },
  pendingButton: {
    padding: 5,
    opacity: 0.6,
  },
  clearButton: {
    position: "absolute",
    right: 65,
    padding: 5,
    zIndex: 1,
  },
  showMoreButton: {
    padding: 10,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    alignItems: "center",
    marginTop: 5,
  },
  showMoreText: {
    color: "#007AFF",
    fontSize: 14,
    fontWeight: "600",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: 70,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#007AFF",
  },
  closeButton: {
    padding: 5,
  },
  modalSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  modalSearchInput: {
    flex: 1,
    height: 45,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingRight: 40,
  },
  modalClearButton: {
    position: "absolute",
    right: 30,
    padding: 5,
  },
  modalContent: {
    padding: 20,
    paddingTop: 0,
  },
});
