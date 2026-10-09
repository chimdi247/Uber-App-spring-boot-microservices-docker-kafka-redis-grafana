import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { config } from "@/lib/config";
import { searchPlaces, type Place } from "@/lib/geo";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  placeholder: string;
  dot: "pickup" | "drop";
  active?: boolean;
  onFocus?: () => void;
  onSelect: (p: Place) => void;
  onTextChange: (t: string) => void;
}

/** Address box backed by OpenStreetMap Nominatim (debounced: the public instance allows ~1 request/second). */
export function PlaceSearch({ value, placeholder, dot, active, onFocus, onSelect, onTextChange }: Props) {
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number>();
  const typed = useRef(false);

  useEffect(() => {
    if (!typed.current) return;
    window.clearTimeout(timer.current);
    if (value.trim().length < 3) {
      setResults([]);
      return;
    }
    timer.current = window.setTimeout(async () => {
      setBusy(true);
      try {
        const [lat, lng] = config.mapCenter;
        setResults(await searchPlaces(value.trim(), { lat, lng }));
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setBusy(false);
      }
    }, 600);
    return () => window.clearTimeout(timer.current);
  }, [value]);

  return (
    <div className="relative">
      <span
        className={cn(
          "absolute left-3 top-1/2 z-10 size-2.5 -translate-y-1/2 rounded-full",
          dot === "pickup" ? "bg-route" : "bg-ink rounded-[2px]",
        )}
      />
      <Input
        value={value}
        placeholder={placeholder}
        className={cn("pl-8 pr-8", active && "ring-2 ring-ring")}
        onFocus={() => {
          onFocus?.();
          if (results.length) setOpen(true);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          typed.current = true;
          onTextChange(e.target.value);
        }}
      />
      {busy && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      {open && results.length > 0 && (
        <ul className="absolute left-0 right-0 top-11 z-20 max-h-64 overflow-auto rounded-md border bg-card py-1 shadow-lg">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onMouseDown={(e) => {
                  e.preventDefault();
                  typed.current = false;
                  onSelect(r);
                  setOpen(false);
                }}
              >
                {r.address}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
