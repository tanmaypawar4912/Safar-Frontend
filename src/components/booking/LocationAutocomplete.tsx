import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { isAxiosError } from "axios";
import { Check, Clock3, LoaderCircle, MapPin, Search } from "lucide-react";

import api from "../../services/api";
import type { CityOption } from "../../data/cities";

interface LocationSuggestion {
  id: string;
  name: string;
  fullAddress: string;
  placeFormatted: string;
  featureType: string;
  category?: string;
}

interface LocationAutocompleteProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onLocationSelected?: (address: string, locationToken: string) => void;
  placeholder: string;
  city: CityOption;
  inputClassName?: string;
  required?: boolean;
  maxLength?: number;
}

interface SuggestionsResponse {
  success: boolean;
  suggestions?: LocationSuggestion[];
  message?: string;
}

interface RetrieveResponse {
  success: boolean;
  location?: { address: string; featureType?: string; locationToken?: string };
  message?: string;
}

function createSessionToken() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function getLocationError(error: unknown) {
  if (isAxiosError(error)) {
    return error.response?.data?.message || "Location suggestions are temporarily unavailable.";
  }
  return error instanceof Error ? error.message : "Location suggestions are temporarily unavailable.";
}

function LocationAutocomplete({
  label,
  value,
  onChange,
  onLocationSelected,
  placeholder,
  city,
  inputClassName = "",
  required = true,
  maxLength = 256,
}: LocationAutocompleteProps) {
  const generatedId = useId();
  const inputId = `location-input-${generatedId}`;
  const listboxId = `location-suggestions-${generatedId}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const sessionTokenRef = useRef("");
  const selectedTextRef = useRef("");
  const didSkipInitialQueryRef = useRef(false);
  const [searchRevision, setSearchRevision] = useState(0);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isRetrieving, setIsRetrieving] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searchError, setSearchError] = useState("");
  const [selectionNote, setSelectionNote] = useState("");

  if (!sessionTokenRef.current) sessionTokenRef.current = createSessionToken();

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    const query = value.trim();
    let cancelled = false;
    const controller = new AbortController();

    if (!didSkipInitialQueryRef.current) {
      didSkipInitialQueryRef.current = true;
      if (query.length >= 3 && query !== selectedTextRef.current) {
        setSuggestions([]);
        setIsOpen(false);
        return () => { cancelled = true; };
      }
    }

    if (query === selectedTextRef.current && query.length > 0) {
      setSuggestions([]);
      setIsOpen(false);
      setIsSearching(false);
      return () => { cancelled = true; };
    }

    if (query.length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      setSearchError("");
      setIsSearching(false);
      return () => { cancelled = true; };
    }

    setSuggestions([]);
    setIsOpen(true);
    setActiveIndex(-1);
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchError("");
      try {
        const response = await api.get<SuggestionsResponse>("/pricing/locations/suggest", {
          params: {
            q: query,
            sessionToken: sessionTokenRef.current,
            city: city.id,
          },
          signal: controller.signal,
        });
        if (cancelled) return;
        if (!response.data.success) {
          throw new Error(response.data.message || "Unable to search locations.");
        }
        const nextSuggestions = Array.isArray(response.data.suggestions) ? response.data.suggestions : [];
        setSuggestions(nextSuggestions);
        setIsOpen(true);
        setActiveIndex(-1);
      } catch (error: unknown) {
        if (cancelled || (isAxiosError(error) && error.code === "ERR_CANCELED")) return;
        setSuggestions([]);
        setIsOpen(true);
        setSearchError(getLocationError(error));
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [value, city.id, searchRevision]);

  const handleInputChange = (nextValue: string) => {
    selectedTextRef.current = "";
    setSelectionNote("");
    setSearchError("");
    onChange(nextValue);
    if (nextValue.trim().length >= 3) setIsOpen(true);
  };

  const chooseSuggestion = async (suggestion: LocationSuggestion) => {
    setIsRetrieving(true);
    setSearchError("");
    setSelectionNote("");
    const sessionToken = sessionTokenRef.current;
    let selectedAddress = suggestion.fullAddress || [suggestion.name, suggestion.placeFormatted].filter(Boolean).join(", ");
    let selectedLocationToken = "";

    try {
      const response = await api.get<RetrieveResponse>("/pricing/locations/retrieve", {
        params: {
          mapboxId: suggestion.id,
          sessionToken,
          city: city.id,
        },
      });
      if (response.data.success && response.data.location?.address) {
        selectedAddress = response.data.location.address;
        selectedLocationToken = response.data.location.locationToken || "";
      } else if (response.data.message) {
        setSelectionNote("Selected place was filled in. The route service will verify it when you calculate the fare.");
      }
    } catch {
      // The suggestion includes a formatted fallback. Let the server-side fare estimator verify it later.
      setSelectionNote("Selected place was filled in. The route service will verify it when you calculate the fare.");
    } finally {
      selectedTextRef.current = selectedAddress;
      if (selectedLocationToken && onLocationSelected) {
        onLocationSelected(selectedAddress, selectedLocationToken);
      } else {
        onChange(selectedAddress);
      }
      sessionTokenRef.current = createSessionToken();
      setSuggestions([]);
      setIsOpen(false);
      setActiveIndex(-1);
      setIsRetrieving(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && suggestions.length > 0) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp" && suggestions.length > 0) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === "Enter" && isOpen && activeIndex >= 0 && suggestions[activeIndex]) {
      event.preventDefault();
      void chooseSuggestion(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div ref={rootRef} className="relative min-w-0">
      <label htmlFor={inputId} className="block text-sm font-bold text-slate-700">{label}</label>
      <div className="relative">
        <input
          id={inputId}
          className={`${inputClassName} pr-10`}
          value={value}
          onChange={(event) => handleInputChange(event.target.value)}
          onFocus={() => {
            if (value.trim().length >= 3 && selectedTextRef.current !== value.trim()) {
              setIsOpen(true);
              setSearchRevision((revision) => revision + 1);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
          maxLength={maxLength}
          required={required}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
          {isSearching || isRetrieving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : value.trim().length > 0 ? <MapPin className="h-4 w-4" /> : <Search className="h-4 w-4" />}
        </span>
      </div>

      {isOpen && value.trim().length >= 3 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.18)]" role="presentation">
          {isSearching && suggestions.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-4 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin text-orange-500" /> Finding locations…</div>
          ) : searchError ? (
            <div className="px-4 py-3.5 text-xs leading-5 text-amber-800"><p className="font-bold">Location search unavailable</p><p className="mt-1">{searchError} You can still enter a complete address manually.</p></div>
          ) : suggestions.length > 0 ? (
            <ul id={listboxId} role="listbox" aria-label={`${label} suggestions`} className="max-h-72 overflow-y-auto py-1.5">
              {suggestions.map((suggestion, index) => (
                <li key={suggestion.id} role="presentation">
                  <button
                    id={`${listboxId}-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={activeIndex === index}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => void chooseSuggestion(suggestion)}
                    className={`flex w-full items-start gap-3 px-3.5 py-3 text-left transition sm:px-4 ${activeIndex === index ? "bg-orange-50" : "hover:bg-slate-50"}`}
                  >
                    <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${suggestion.featureType === "poi" ? "bg-orange-50 text-orange-600" : "bg-slate-100 text-slate-600"}`}>
                      {suggestion.featureType === "poi" ? <MapPin className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-extrabold text-slate-800">{suggestion.name}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-500">{suggestion.placeFormatted || suggestion.fullAddress}</span>
                      {suggestion.category && <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">{suggestion.category}</span>}
                    </span>
                    {activeIndex === index && <Check className="mt-1 h-4 w-4 shrink-0 text-orange-600" />}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-4 text-sm text-slate-500"><p className="font-bold text-slate-700">No matching places found</p><p className="mt-1 text-xs leading-5">Try a locality, street, landmark or nearby city.</p></div>
          )}
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/90 px-4 py-2">
            <span className="text-[10px] text-slate-400">Suggestions near {city.name}</span>
            <span className="text-[10px] font-bold tracking-wide text-slate-500">Powered by Mapbox</span>
          </div>
        </div>
      )}

      {selectionNote && <p role="status" className="mt-1.5 text-[11px] leading-4 text-amber-700">{selectionNote}</p>}
      {value.trim().length >= 3 && !isOpen && !isSearching && !selectionNote && (
        <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] leading-4 text-slate-400"><Clock3 className="h-3 w-3" /> Choose a suggestion when available, or enter the full address.</p>
      )}
    </div>
  );
}

export default LocationAutocomplete;
