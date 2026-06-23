import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../contexts/AppContext";
import { getTheme } from "../services/theme";
import { Badge } from "../components/Badge";

const colorMap = {
  amber: "#F59E0B",
  emerald: "#059669",
  rose: "#EF4444",
  blue: "#3B82F6",
  purple: "#7C3AED",
  cyan: "#0891B2",
};

const monthTitleFormatter = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const monthShortFormatter = new Intl.DateTimeFormat(undefined, { month: "short" });
const selectedDayLabelFormatter = new Intl.DateTimeFormat(undefined, {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const toDateValue = (value) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeToDay = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

const toMonthKey = (value) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;

const toDateKey = (value) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

const dateKeyToDate = (value = "") => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const EventsScreen = () => {
  const navigation = useNavigation();
  const { dark, events } = useApp();
  const insets = useSafeAreaInsets();
  const theme = useMemo(() => getTheme(dark), [dark]);

  const [view, setView] = useState("list");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));

  const sortedEvents = useMemo(
    () =>
      [...events].sort((a, b) => {
        const aStart = toDateValue(a.startDateTime || a.date) || new Date(0);
        const bStart = toDateValue(b.startDateTime || b.date) || new Date(0);
        return aStart.getTime() - bStart.getTime();
      }),
    [events]
  );

  const eventDaysByMonth = useMemo(() => {
    const map = {};
    sortedEvents.forEach((event) => {
      const start = toDateValue(event.startDateTime || event.date);
      if (!start) return;
      const end = toDateValue(event.endDateTime) || start;
      const safeStart = normalizeToDay(start);
      const safeEnd = normalizeToDay(end < start ? start : end);
      const eventColor = colorMap[event.color] || theme.accent;
      for (let cursor = new Date(safeStart); cursor <= safeEnd; cursor.setDate(cursor.getDate() + 1)) {
        const monthKey = toMonthKey(cursor);
        if (!map[monthKey]) {
          map[monthKey] = {};
        }
        const day = cursor.getDate();
        if (!map[monthKey][day]) {
          map[monthKey][day] = new Set();
        }
        map[monthKey][day].add(eventColor);
      }
    });
    return map;
  }, [sortedEvents, theme.accent]);

  const eventsByDate = useMemo(() => {
    const map = {};
    sortedEvents.forEach((event) => {
      const start = toDateValue(event.startDateTime || event.date);
      if (!start) return;
      const end = toDateValue(event.endDateTime) || start;
      const safeStart = normalizeToDay(start);
      const safeEnd = normalizeToDay(end < start ? start : end);
      for (let cursor = new Date(safeStart); cursor <= safeEnd; cursor.setDate(cursor.getDate() + 1)) {
        const key = toDateKey(cursor);
        if (!map[key]) map[key] = [];
        map[key].push(event);
      }
    });
    Object.keys(map).forEach((key) => {
      map[key].sort((a, b) => {
        const aStart = toDateValue(a.startDateTime || a.date) || new Date(0);
        const bStart = toDateValue(b.startDateTime || b.date) || new Date(0);
        return aStart.getTime() - bStart.getTime();
      });
    });
    return map;
  }, [sortedEvents]);

  const monthStart = useMemo(
    () => new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1),
    [calendarMonth]
  );
  const firstWeekday = monthStart.getDay();
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const highlightedDays = eventDaysByMonth[toMonthKey(monthStart)] || {};

  const selectedDateObj = dateKeyToDate(selectedDateKey) || monthStart;
  const selectedDayEvents = eventsByDate[selectedDateKey] || [];

  const goToPreviousMonth = () => {
    setCalendarMonth((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
      setSelectedDateKey(toDateKey(next));
      return next;
    });
  };

  const goToNextMonth = () => {
    setCalendarMonth((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
      setSelectedDateKey(toDateKey(next));
      return next;
    });
  };

  const openCreateEvent = () => {
    navigation.navigate("Compose", {
      initialDate: selectedDateKey,
      presetCategory: "Cultural Events",
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.header,
            borderBottomColor: theme.border,
            paddingTop: Math.max(12, insets.top + 8),
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: theme.text }]}>Events</Text>
          <View style={[styles.switchWrap, { backgroundColor: theme.input }]}>
            {[
              ["list", "List"],
              ["cal", "Calendar"],
            ].map(([key, label]) => (
              <Pressable
                key={key}
                onPress={() => setView(key)}
                style={[styles.switchBtn, view === key && { backgroundColor: theme.accent }]}
              >
                <Text style={[styles.switchText, { color: view === key ? "#FFFFFF" : theme.text2 }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {view === "cal" ? (
          <View style={[styles.calendarCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.calendarTitleRow}>
              <Pressable
                onPress={goToPreviousMonth}
                style={[styles.monthNavBtn, { borderColor: theme.border, backgroundColor: theme.input }]}
              >
                <Text style={[styles.monthNavText, { color: theme.text }]}>{"<"}</Text>
              </Pressable>
              <Text style={[styles.calendarTitle, { color: theme.text }]}>{monthTitleFormatter.format(monthStart)}</Text>
              <Pressable
                onPress={goToNextMonth}
                style={[styles.monthNavBtn, { borderColor: theme.border, backgroundColor: theme.input }]}
              >
                <Text style={[styles.monthNavText, { color: theme.text }]}>{">"}</Text>
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                <Text key={`${day}-${index}`} style={[styles.weekLabel, { color: theme.text3 }]}>{day}</Text>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {Array.from({ length: firstWeekday }).map((_, index) => (
                <View key={`blank-${index}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => {
                const dayColors = Array.from(highlightedDays[day] || []);
                const hasEvent = dayColors.length > 0;
                const primaryColor = dayColors[0] || theme.accent;
                const dayValue = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
                const dayKey = toDateKey(dayValue);
                const isSelected = selectedDateKey === dayKey;
                return (
                  <Pressable
                    key={day}
                    onPress={() => setSelectedDateKey(dayKey)}
                    style={[
                      styles.dayCell,
                      {
                        backgroundColor: hasEvent ? `${primaryColor}22` : theme.bg,
                        borderColor: isSelected ? theme.accent : hasEvent ? `${primaryColor}66` : "transparent",
                      },
                    ]}
                  >
                    <Text style={[styles.dayText, { color: hasEvent ? primaryColor : theme.text }]}>{day}</Text>
                    {hasEvent ? (
                      <View style={styles.dayDots}>
                        {dayColors.slice(0, 3).map((color) => (
                          <View key={`${day}-${color}`} style={[styles.dayDot, { backgroundColor: color }]} />
                        ))}
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.legendRow}>
              {[
                ["#3B82F6", "Academics"],
                ["#059669", "Sports"],
                ["#EF4444", "Exams"],
                ["#7C3AED", "Cultural"],
              ].map(([color, label]) => (
                <View key={label} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: color }]} />
                  <Text style={[styles.legendText, { color: theme.text2 }]}>{label}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.selectedDayCard, { borderColor: theme.border, backgroundColor: theme.card2 }]}>
              <View style={styles.selectedDayHeader}>
                <Text style={[styles.selectedDayTitle, { color: theme.text }]}>
                  {selectedDayLabelFormatter.format(selectedDateObj)}
                </Text>
                <Pressable onPress={openCreateEvent} style={[styles.createBtn, { backgroundColor: theme.accent }]}>
                  <Text style={styles.createBtnText}>Create Event</Text>
                </Pressable>
              </View>

              {selectedDayEvents.length === 0 ? (
                <Text style={[styles.selectedDayEmpty, { color: theme.text3 }]}>No events on this day.</Text>
              ) : (
                selectedDayEvents.map((event) => {
                  const color = colorMap[event.color] || theme.accent;
                  return (
                    <View key={`${selectedDateKey}-${event.id}`} style={[styles.dayEventRow, { borderColor: theme.border }]}>
                      <View style={[styles.dayEventDot, { backgroundColor: color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.dayEventTitle, { color: theme.text }]}>{event.title}</Text>
                        <Text style={[styles.dayEventMeta, { color: theme.text2 }]}>
                          {event.time} | {event.venue}
                        </Text>
                      </View>
                      <Badge text={event.category} color={color} small />
                    </View>
                  );
                })
              )}
            </View>
          </View>
        ) : null}

        <Text style={[styles.upcomingLabel, { color: theme.text2 }]}>Upcoming</Text>

        {events.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={[styles.emptyText, { color: theme.text3 }]}>No scheduled posts yet.</Text>
          </View>
        ) : null}

        {sortedEvents.map((event) => {
          const startDate = toDateValue(event.startDateTime || event.date) || new Date();
          const color = colorMap[event.color] || theme.accent;
          return (
            <View key={event.id} style={[styles.eventCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[styles.dateBox, { backgroundColor: `${color}22` }]}>
                <Text style={[styles.dateDay, { color }]}>{startDate.getDate()}</Text>
                <Text style={[styles.dateMonth, { color }]}>{monthShortFormatter.format(startDate).toUpperCase()}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.eventTitle, { color: theme.text }]}>{event.title}</Text>
                <Text style={[styles.eventSub, { color: theme.text2 }]}>Time: {event.time} | Venue: {event.venue}</Text>
              </View>

              <View style={styles.eventActions}>
                <Badge text={event.category} color={color} small />
                {event.status === "pending" ? <Badge text="Pending" color="#B45309" small /> : null}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
  },
  switchWrap: {
    borderRadius: 10,
    padding: 3,
    flexDirection: "row",
    gap: 2,
  },
  switchBtn: {
    minHeight: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  switchText: {
    fontSize: 11,
    fontWeight: "700",
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 100,
  },
  calendarCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
  },
  calendarTitle: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "800",
  },
  calendarTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  monthNavBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  monthNavText: {
    fontSize: 14,
    fontWeight: "900",
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  weekLabel: {
    width: "14.2%",
    textAlign: "center",
    fontSize: 10,
    fontWeight: "700",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
  },
  dayCell: {
    width: "13.6%",
    aspectRatio: 1,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  dayText: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  dayDots: {
    position: "absolute",
    bottom: 3,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 2,
  },
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  legendRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 10,
    fontWeight: "600",
  },
  selectedDayCard: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 9,
  },
  selectedDayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectedDayTitle: {
    fontSize: 12.5,
    fontWeight: "800",
  },
  createBtn: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  createBtnText: {
    color: "#FFFFFF",
    fontSize: 10.5,
    fontWeight: "800",
  },
  selectedDayEmpty: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  dayEventRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dayEventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dayEventTitle: {
    fontSize: 11.5,
    fontWeight: "800",
    marginBottom: 2,
  },
  dayEventMeta: {
    fontSize: 10.5,
    fontWeight: "500",
  },
  upcomingLabel: {
    marginBottom: 10,
    fontSize: 11.5,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  emptyWrap: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  eventCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 10,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  dateBox: {
    width: 46,
    borderRadius: 11,
    paddingVertical: 9,
    alignItems: "center",
  },
  dateDay: {
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 18,
  },
  dateMonth: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  eventTitle: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 4,
    lineHeight: 18,
  },
  eventSub: {
    fontSize: 11,
    fontWeight: "500",
  },
  eventActions: {
    alignItems: "flex-end",
    gap: 5,
  },
});

export default EventsScreen;
