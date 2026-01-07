import React, { useState, useRef, useEffect } from "react";
import {
  SafeAreaView,
  View,
  ScrollView,
  Image,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  FlatList,
  StatusBar,
  Dimensions,
  Animated,
  Easing,
  Modal,
  Pressable,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MOCK_DATA, FILTERS } from "../constants/mockData";

const { width } = Dimensions.get("window");

export default function HomeScreen() {
  const [textInput1, setTextInput1] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [filters, setFilters] = useState(FILTERS);
  const [cards, setCards] = useState(MOCK_DATA);

  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [newFilterName, setNewFilterName] = useState("");

  const [selectedCard, setSelectedCard] = useState(null);
  const [isCardMenuVisible, setIsCardMenuVisible] = useState(false);
  const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isAssignFilterVisible, setIsAssignFilterVisible] = useState(false);

  const [isAccountModalVisible, setIsAccountModalVisible] = useState(false);

  // FAB State
  const [isFabExpanded, setIsFabExpanded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // FAB Animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: isFabExpanded ? 1 : 0,
      duration: 200,
      easing: Easing.ease,
    }).start();
  }, [isFabExpanded]);

  const filteredData = cards.filter((item) => {
    const matchesSearch = item.title
      .toLowerCase()
      .includes(textInput1.toLowerCase());
    if (activeFilter === "All") return matchesSearch;
    if (activeFilter === "Favorites") return matchesSearch && item.isFavorite;
    return matchesSearch && item.category === activeFilter;
  });

  const handleAddFilter = () => {
    setNewFilterName("");
    setIsFilterModalVisible(true);
  };

  const saveNewFilter = () => {
    const name = newFilterName.trim();
    if (!name) {
      Alert.alert("Filter name required");
      return;
    }
    if (filters.includes(name)) {
      Alert.alert("Filter already exists");
      return;
    }
    const updated = [...filters, name];
    setFilters(updated);
    setIsFilterModalVisible(false);
    setActiveFilter(name);
  };

  const toggleFavorite = (id) => {
    setCards((prev) =>
      prev.map((card) =>
        card.id === id ? { ...card, isFavorite: !card.isFavorite } : card
      )
    );
  };

  const openCardMenu = (card) => {
    setSelectedCard(card);
    setIsCardMenuVisible(true);
  };

  const closeCardMenu = () => {
    setIsCardMenuVisible(false);
  };

  const handleDeleteCard = () => {
    if (!selectedCard) return;
    setCards((prev) =>
      prev.filter((card) => card.id !== selectedCard.id)
    );
    setIsCardMenuVisible(false);
  };

  const handleRenameCard = () => {
    if (!selectedCard) return;
    setRenameValue(selectedCard.title);
    setIsCardMenuVisible(false);
    setIsRenameModalVisible(true);
  };

  const saveRename = () => {
    const name = renameValue.trim();
    if (!name) {
      Alert.alert("Title required");
      return;
    }
    setCards((prev) =>
      prev.map((card) =>
        card.id === selectedCard.id ? { ...card, title: name } : card
      )
    );
    setIsRenameModalVisible(false);
  };

  const openAssignFilter = () => {
    setIsCardMenuVisible(false);
    setIsAssignFilterVisible(true);
  };

  const assignFilterToCard = (filterName) => {
    if (!selectedCard) return;
    setCards((prev) =>
      prev.map((card) =>
        card.id === selectedCard.id ? { ...card, category: filterName } : card
      )
    );
    setIsAssignFilterVisible(false);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.column3}
      onPress={() => alert(`Opening ${item.title}`)}
    >
      <View style={styles.row5}>
        <Text style={styles.text5} numberOfLines={1}>
          {item.title}
        </Text>
        <Image
          source={{ uri: item.image }}
          resizeMode={"cover"}
          style={styles.image5}
        />
      </View>
      <View style={styles.row6}>
        <View style={styles.row7}>
          <Image
            source={{
              uri: "https://storage.googleapis.com/tagjs-prod.appspot.com/v1/JWx5b4z3d8/fb3lsel6_expires_30_days.png",
            }}
            resizeMode={"stretch"}
            style={styles.image6}
          />
          <Text style={styles.text6}>{item.date}</Text>
        </View>
        <View style={styles.row8}>
          <Image
            source={{
              uri: "https://storage.googleapis.com/tagjs-prod.appspot.com/v1/JWx5b4z3d8/ujsytc65_expires_30_days.png",
            }}
            resizeMode={"stretch"}
            style={styles.image6}
          />
          <Text style={styles.text6}>{item.duration}</Text>
        </View>
      </View>
      <View style={styles.row9}>
        <View style={styles.row10}>
          <TouchableOpacity
            style={styles.view2}
            onPress={() => toggleFavorite(item.id)}
          >
            <Image
              source={{
                uri: "https://storage.googleapis.com/tagjs-prod.appspot.com/v1/JWx5b4z3d8/zhqyx54k_expires_30_days.png",
              }}
              resizeMode={"stretch"}
              style={[
                styles.image7,
                item.isFavorite && styles.favoriteTint,
              ]}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.view3}
            onPress={() => alert("Share clicked")}
          >
            <Image
              source={{
                uri: "https://storage.googleapis.com/tagjs-prod.appspot.com/v1/JWx5b4z3d8/8iuoko8m_expires_30_days.png",
              }}
              resizeMode={"stretch"}
              style={styles.image7}
            />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => openCardMenu(item)}>
          <Image
            source={{
              uri: "https://storage.googleapis.com/tagjs-prod.appspot.com/v1/JWx5b4z3d8/pstw3qkp_expires_30_days.png",
            }}
            resizeMode={"stretch"}
            style={styles.image8}
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.contentContainer}>
        <View style={styles.row}>
          <View style={styles.row2}>
            <Image
              source={{
                uri: "https://storage.googleapis.com/tagjs-prod.appspot.com/v1/JWx5b4z3d8/2g25thzd_expires_30_days.png",
              }}
              resizeMode={"stretch"}
              style={styles.image}
            />
            <View style={styles.view}>
              <Text style={styles.text}>{"Memry"}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.button}
            onPress={() => setIsAccountModalVisible(true)}
          >
            <Text style={styles.text2}>{"S"}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerColumn}>
          <View style={styles.row3}>
            <Image
              source={{
                uri: "https://storage.googleapis.com/tagjs-prod.appspot.com/v1/JWx5b4z3d8/pgamrn3r_expires_30_days.png",
              }}
              resizeMode={"stretch"}
              style={styles.image2}
            />
            <TextInput
              placeholder={"Search"}
              value={textInput1}
              onChangeText={setTextInput1}
              style={styles.input}
              placeholderTextColor="#999"
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filtersScroll}
          >
            <View style={styles.row4}>
              {filters.map((filter) => (
                <TouchableOpacity
                  key={filter}
                  style={[
                    styles.buttonRow,
                    activeFilter === filter && {
                      backgroundColor: "#212121",
                    },
                  ]}
                  onPress={() => setActiveFilter(filter)}
                >
                  {filter === "Favorites" && (
                    <Image
                      source={{
                        uri: "https://storage.googleapis.com/tagjs-prod.appspot.com/v1/JWx5b4z3d8/sicdh94m_expires_30_days.png",
                      }}
                      resizeMode={"stretch"}
                      style={[
                        styles.image3,
                        activeFilter === filter && {
                          tintColor: "#FFFFFF",
                        },
                      ]}
                    />
                  )}
                  {filter === "Physics" && (
                    <Image
                      source={{
                        uri: "https://storage.googleapis.com/tagjs-prod.appspot.com/v1/JWx5b4z3d8/gdradsz9_expires_30_days.png",
                      }}
                      resizeMode={"stretch"}
                      style={[
                        styles.image3,
                        activeFilter === filter && {
                          tintColor: "#FFFFFF",
                        },
                      ]}
                    />
                  )}
                  <Text
                    style={
                      activeFilter === filter
                        ? styles.text3
                        : styles.text4
                    }
                    numberOfLines={1}
                  >
                    {filter}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={handleAddFilter}>
                <Image
                  source={{
                    uri: "https://storage.googleapis.com/tagjs-prod.appspot.com/v1/JWx5b4z3d8/acs3pgrb_expires_30_days.png",
                  }}
                  resizeMode={"stretch"}
                  style={styles.image4}
                />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>

        <FlatList
          data={filteredData}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* FAB */}
      <View style={styles.fabWrapper}>
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={styles.fabMenuContainer}>
            <TouchableOpacity
              style={styles.fabMenuItem}
              onPress={() => alert("Upload pressed")}
            >
              <Ionicons name="cloud-upload" size={16} color="#FFF" />
              <Text style={styles.fabMenuText}>Upload</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.fabMenuItem}
              onPress={() => alert("Record pressed")}
            >
              <Ionicons name="mic" size={16} color="#FFF" />
              <Text style={styles.fabMenuText}>Record</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setIsFabExpanded(!isFabExpanded)}
        >
          <Ionicons
            name={isFabExpanded ? "close" : "add"}
            size={24}
            color="#FFF"
          />
        </TouchableOpacity>
      </View>

      {/* Account Settings Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={isAccountModalVisible}
        onRequestClose={() => setIsAccountModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsAccountModalVisible(false)}
        >
          <View style={styles.modalContent} pointerEvents="box-none">
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Account</Text>
              <Pressable
                style={styles.modalButton}
                onPress={() => Alert.alert("Profile")}
              >
                <Text style={styles.modalButtonText}>Profile</Text>
              </Pressable>
              <Pressable
                style={styles.modalButton}
                onPress={() => Alert.alert("Notifications")}
              >
                <Text style={styles.modalButtonText}>Notifications</Text>
              </Pressable>
              <Pressable
                style={styles.modalButton}
                onPress={() => Alert.alert("Logged out")}
              >
                <Text style={styles.modalButtonText}>Logout</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Add Filter Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={isFilterModalVisible}
        onRequestClose={() => setIsFilterModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsFilterModalVisible(false)}
        >
          <View style={styles.modalContent} pointerEvents="box-none">
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>New Filter</Text>
              <TextInput
                placeholder="Filter name"
                placeholderTextColor="#888"
                value={newFilterName}
                onChangeText={setNewFilterName}
                style={styles.modalInput}
              />
              <View style={styles.modalActions}>
                <Pressable
                  style={styles.modalButton}
                  onPress={() =>
                    setIsFilterModalVisible(false)
                  }
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.modalButton}
                  onPress={saveNewFilter}
                >
                  <Text style={styles.modalButtonText}>Save</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Card Menu Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={isCardMenuVisible}
        onRequestClose={closeCardMenu}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={closeCardMenu}
        >
          <View style={styles.modalContent} pointerEvents="box-none">
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {selectedCard?.title || "Options"}
              </Text>
              <Pressable
                style={styles.modalButton}
                onPress={handleRenameCard}
              >
                <Text style={styles.modalButtonText}>Rename</Text>
              </Pressable>
              <Pressable
                style={styles.modalButton}
                onPress={openAssignFilter}
              >
                <Text style={styles.modalButtonText}>
                  Assign Filter
                </Text>
              </Pressable>
              <Pressable
                style={styles.modalButton}
                onPress={handleDeleteCard}
              >
                <Text
                  style={[
                    styles.modalButtonText,
                    { color: "#D00" },
                  ]}
                >
                  Delete
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Rename Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={isRenameModalVisible}
        onRequestClose={() => setIsRenameModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsRenameModalVisible(false)}
        >
          <View style={styles.modalContent} pointerEvents="box-none">
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Rename</Text>
              <TextInput
                placeholder="New title"
                placeholderTextColor="#888"
                value={renameValue}
                onChangeText={setRenameValue}
                style={styles.modalInput}
              />
              <View style={styles.modalActions}>
                <Pressable
                  style={styles.modalButton}
                  onPress={() =>
                    setIsRenameModalVisible(false)
                  }
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.modalButton}
                  onPress={saveRename}
                >
                  <Text style={styles.modalButtonText}>Save</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Assign Filter Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={isAssignFilterVisible}
        onRequestClose={() => setIsAssignFilterVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsAssignFilterVisible(false)}
        >
          <View style={styles.modalContent} pointerEvents="box-none">
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Assign Filter</Text>
              <ScrollView style={{ maxHeight: 200 }}>
                {filters
                  .filter((f) => f !== "All" && f !== "Favorites")
                  .map((filter) => (
                    <Pressable
                      key={filter}
                      style={styles.modalButton}
                      onPress={() =>
                        assignFilterToCard(filter)
                      }
                    >
                      <Text style={styles.modalButtonText}>
                        {filter}
                      </Text>
                    </Pressable>
                  ))}
              </ScrollView>
              <Pressable
                style={styles.modalButton}
                onPress={() =>
                  setIsAssignFilterVisible(false)
                }
              >
                <Text style={styles.modalButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  contentContainer: {
    flex: 1,
  },
  button: {
    height: 32,
    width: 32,
    backgroundColor: "#212121",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonRow: {
    flexDirection: "row",
    backgroundColor: "#E4E4E4",
    borderColor: "#E6E6E6",
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    alignItems: "center",
  },
  headerColumn: {
    marginBottom: 20,
    marginHorizontal: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  column3: {
    backgroundColor: "#FFFFFF",
    borderColor: "#EAEAEA",
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    shadowColor: "#D9D9D9",
    shadowOpacity: 0.3,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowRadius: 10,
    elevation: 4,
  },
  image: {
    width: 40,
    height: 40,
    marginRight: 8,
  },
  image2: {
    width: 16,
    height: 16,
    marginLeft: 16,
    marginRight: 8,
    tintColor: "#666",
  },
  image3: {
    width: 14,
    height: 14,
    marginRight: 6,
  },
  image4: {
    width: 32,
    height: 32,
  },
  image5: {
    borderRadius: 10,
    width: 24,
    height: 24,
  },
  image6: {
    width: 12,
    height: 12,
    marginRight: 4,
    tintColor: "#868686",
  },
  image7: {
    width: 14,
    height: 14,
    tintColor: "#555",
  },
  image8: {
    width: 46,
    height: 32,
    resizeMode: "contain",
  },
  input: {
    color: "#000000",
    fontSize: 14,
    marginRight: 4,
    flex: 1,
    paddingVertical: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 15,
    marginTop: 10,
    marginBottom: 10,
    marginHorizontal: 16,
  },
  row2: {
    flexDirection: "row",
    alignItems: "center",
  },
  row3: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F0F0",
    borderRadius: 16,
    marginBottom: 16,
    height: 44,
  },
  row4: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 16,
  },
  filtersScroll: {
    flexGrow: 0,
  },
  row5: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  row6: {
    flexDirection: "row",
    marginBottom: 12,
    alignItems: "center",
  },
  row7: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  row8: {
    flexDirection: "row",
    alignItems: "center",
  },
  row9: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  row10: {
    flexDirection: "row",
    alignItems: "center",
  },
  text: {
    color: "#000000",
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "System",
  },
  text2: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  text3: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  text4: {
    color: "#4D4D4D",
    fontSize: 13,
    fontWeight: "600",
  },
  text5: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  text6: {
    color: "#868686",
    fontSize: 12,
    fontWeight: "500",
  },
  view: {
    justifyContent: "center",
  },
  view2: {
    backgroundColor: "#F7F7F7",
    borderRadius: 6,
    padding: 6,
    marginRight: 8,
  },
  view3: {
    backgroundColor: "#F7F7F7",
    borderRadius: 6,
    padding: 6,
  },
  fabWrapper: {
    position: "absolute",
    bottom: 30,
    right: 30,
    alignItems: "center",
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1C1C1E",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 8,
  },
  fabMenuContainer: {
    position: "absolute",
    bottom: -40,
    right: -30,
    alignItems: "flex-end",
    gap: 10,
  },
  fabMenuItem: {
    backgroundColor: "#212121",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
  fabMenuText: { color: "#FFF", fontWeight: "600" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: { width: "100%" },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    color: "#000",
  },
  modalInput: {
    borderColor: "#E0E0E0",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#000",
    marginBottom: 12,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end" },
  modalButton: { paddingVertical: 10 },
  modalButtonText: {
    color: "#1C1C1E",
    fontWeight: "600",
    fontSize: 14,
  },
  favoriteTint: { tintColor: "#e67e22" },
});
