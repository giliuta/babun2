import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Animated, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ToastType = "success" | "error" | "info";
type ToastState = { id: number; message: string; type: ToastType };

const ToastCtx = createContext<(message: string, type?: ToastType) => void>(
  () => {},
);

export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const show = useCallback(
    (message: string, type: ToastType = "success") => {
      setToast({ id: Date.now(), message, type });
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
      ]).start();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -12, duration: 220, useNativeDriver: true }),
        ]).start(() => setToast(null));
      }, 2200);
    },
    [opacity, translateY],
  );

  const bg =
    toast?.type === "error"
      ? "bg-danger"
      : toast?.type === "info"
        ? "bg-neutral-800"
        : "bg-success";

  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: insets.top + 8,
            left: 16,
            right: 16,
            opacity,
            transform: [{ translateY }],
          }}
        >
          <View className={`rounded-2xl px-4 py-3 shadow-lg ${bg}`}>
            <Text className="text-center text-sm font-semibold text-white">
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastCtx.Provider>
  );
}
