import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Landmark, MapPin, Search, X } from "lucide-react";

import {
  CITY_OPTIONS,
  saveSelectedCity,
  type CityOption,
} from "../../data/cities";

interface CityPickerProps {
  city: CityOption;
  onChange: (city: CityOption) => void;
  compact?: boolean;
  className?: string;
}

const tileThemes = [
  "from-orange-50 to-amber-100 text-orange-600",
  "from-sky-50 to-blue-100 text-blue-600",
  "from-emerald-50 to-teal-100 text-emerald-600",
  "from-violet-50 to-fuchsia-100 text-violet-600",
  "from-rose-50 to-pink-100 text-rose-600",
  "from-cyan-50 to-sky-100 text-cyan-700",
];

function CityPicker({ city, onChange, compact = false, className = "" }: CityPickerProps) {
  const dialogTitleId = `logigo-city-dialog-${useId()}`;
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const filteredCities = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return CITY_OPTIONS;
    return CITY_OPTIONS.filter((item) =>
      `${item.name} ${item.state}`.toLowerCase().includes(normalized)
    );
  }, [search]);

  useEffect(() => {
    if (!isOpen) return;
    searchRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const chooseCity = (selectedCity: CityOption) => {
    saveSelectedCity(selectedCity);
    onChange(selectedCity);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Selected city ${city.name}. Change booking city`}
        className={`inline-flex min-h-10 max-w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-orange-300 hover:bg-orange-50/50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-100 ${compact ? "min-h-9 px-2.5 text-xs" : ""} ${className}`}
      >
        <MapPin className="h-4 w-4 shrink-0 text-orange-500" aria-hidden="true" />
        <span className="max-w-[110px] truncate">{city.name}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
      </button>

      {isOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6">
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-slate-950/55 backdrop-blur-[3px]"
            aria-label="Close city selector"
            onClick={() => setIsOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            className="relative z-10 flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl shadow-slate-950/25"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-7 sm:py-6">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-orange-700">
                  <MapPin className="h-3.5 w-3.5" /> Safar locations
                </div>
                <h2 id={dialogTitleId} className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">Choose your city</h2>
                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">Pick a city to personalize location suggestions. Pickup and drop-off can still be in different cities.</p>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900" aria-label="Close city selector">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-slate-100 px-5 py-4 sm:px-7">
              <label className="relative block">
                <span className="sr-only">Search cities</span>
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search city or state…"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                />
              </label>
            </div>

            <div className="overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
              {filteredCities.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
                  {filteredCities.map((item) => {
                    const selected = item.id === city.id;
                    const originalIndex = CITY_OPTIONS.findIndex((cityOption) => cityOption.id === item.id);
                    return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => chooseCity(item)}
                        aria-pressed={selected}
                        className={`group relative rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-100 sm:p-3.5 ${selected ? "border-orange-400 bg-orange-50/70 shadow-sm shadow-orange-500/5" : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-orange-200 hover:bg-slate-50 hover:shadow-md"}`}
                      >
                        <span className={`relative mb-3 flex h-14 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br ${tileThemes[originalIndex % tileThemes.length]}`}>
                          <span aria-hidden="true" className="absolute -right-3 -top-4 h-14 w-14 rounded-full border border-current/10" />
                          <Landmark className="h-7 w-7 transition-transform group-hover:scale-110" aria-hidden="true" />
                          <span className="absolute bottom-2 right-2 h-1.5 w-1.5 rounded-full bg-current/60" />
                        </span>
                        <span className="flex items-center justify-between gap-1">
                          <span className="min-w-0 truncate text-sm font-extrabold text-slate-900">{item.name}</span>
                          {selected && <Check className="h-4 w-4 shrink-0 text-orange-600" aria-hidden="true" />}
                        </span>
                        <span className="mt-1 block truncate text-[11px] font-medium text-slate-500">{item.state}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center">
                  <MapPin className="mx-auto h-6 w-6 text-slate-300" />
                  <p className="mt-2 text-sm font-bold text-slate-700">No matching city</p>
                  <p className="mt-1 text-xs text-slate-500">Try a different city or state name.</p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <p className="text-xs leading-5 text-slate-500">Selected city: <span className="font-extrabold text-slate-800">{city.name}, {city.state}</span></p>
              <p className="text-[11px] leading-5 text-slate-400">This city prioritizes place suggestions; it does not guarantee delivery coverage.</p>
            </div>
          </section>
        </div>,
        document.body
      )}
    </>
  );
}

export default CityPicker;
