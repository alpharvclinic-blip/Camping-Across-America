import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";

type MapCategory = {
  name: string;
  color: string;
  count: number;
  sourceLayers: string[];
};

type MapLocation = {
  id: string;
  name: string;
  category: string;
  sourceLayer: string;
  color: string;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  stateCode?: string;
  address: string;
  zipCode: string;
  searchText: string;
  attributes: Record<string, string>;
};

type MapDataset = {
  source: {
    title: string;
    url: string;
    mapId: string;
  };
  categories: MapCategory[];
  locations: MapLocation[];
};

const PAGE_SIZE = 100;
const DEFAULT_CENTER: [number, number] = [39.5, -98.35];
const DEFAULT_ZOOM = 4;

function normalizeSearch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function locationSubtitle(location: MapLocation) {
  const cityState = [location.city, location.stateCode || location.state]
    .filter(Boolean)
    .join(", ");

  if (cityState) return cityState;
  return location.address || location.category;
}

function popupContent(location: MapLocation) {
  const wrapper = document.createElement("div");
  wrapper.className = "map-popup";

  const title = document.createElement("strong");
  title.textContent = location.name;
  wrapper.appendChild(title);

  const category = document.createElement("span");
  category.className = "popup-category";
  category.textContent = location.category;
  wrapper.appendChild(category);

  const place = locationSubtitle(location);
  if (place) {
    const subtitle = document.createElement("span");
    subtitle.textContent = place;
    wrapper.appendChild(subtitle);
  }

  if (location.address && location.address !== place) {
    const address = document.createElement("span");
    address.className = "popup-address";
    address.textContent = location.address;
    wrapper.appendChild(address);
  }

  return wrapper;
}

function MapFocus({
  selectedLocation,
  locations,
  search,
}: {
  selectedLocation: MapLocation | null;
  locations: MapLocation[];
  search: string;
}) {
  const map = useMap();
  const previousId = useRef<string | null>(null);
  const previousSearch = useRef("");

  useEffect(() => {
    if (selectedLocation && selectedLocation.id !== previousId.current) {
      map.flyTo(
        [selectedLocation.latitude, selectedLocation.longitude],
        Math.max(map.getZoom(), 10),
        { duration: 0.65 },
      );
      previousId.current = selectedLocation.id;
      return;
    }

    if (search.trim() && search !== previousSearch.current && locations.length) {
      if (locations.length === 1) {
        map.flyTo(
          [locations[0].latitude, locations[0].longitude],
          Math.max(map.getZoom(), 10),
          { duration: 0.65 },
        );
      } else {
        const bounds = L.latLngBounds(
          locations.map(
            (location) =>
              [location.latitude, location.longitude] as [number, number],
          ),
        );
        map.flyToBounds(bounds, { padding: [42, 42], maxZoom: 10, duration: 0.65 });
      }
    } else if (!search.trim() && previousSearch.current) {
      map.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, { duration: 0.65 });
    }

    previousSearch.current = search;
  }, [locations, map, search, selectedLocation]);

  return null;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m15.5 15.5 4.1 4.1" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  );
}

function App() {
  const [dataset, setDataset] = useState<MapDataset | null>(null);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    new Set(),
  );
  const [selectedLocation, setSelectedLocation] =
    useState<MapLocation | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [categoriesExpanded, setCategoriesExpanded] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/data/locations.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error("The map locations could not be loaded.");
        }
        return response.json() as Promise<MapDataset>;
      })
      .then((data) => {
        if (cancelled) return;
        setDataset(data);
        setActiveCategories(new Set(data.categories.map((category) => category.name)));
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(
            "The imported map data did not load. Refresh the page and try again.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredLocations = useMemo(() => {
    if (!dataset) return [];
    const normalizedSearch = normalizeSearch(search);

    return dataset.locations.filter((location) => {
      if (!activeCategories.has(location.category)) return false;
      if (!normalizedSearch) return true;

      const searchable = [
        location.searchText,
        location.name,
        location.category,
        location.city,
        location.state,
        location.stateCode,
        location.address,
        location.zipCode,
        ...Object.values(location.attributes),
      ]
        .filter(Boolean)
        .join(" ")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();

      return searchable.includes(normalizedSearch);
    });
  }, [activeCategories, dataset, search]);

  const visibleLocations = filteredLocations.slice(0, visibleCount);
  const activeCategoryKey = [...activeCategories].sort().join("|");

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [activeCategoryKey, search]);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    setSelectedLocation(null);
  };

  const toggleCategory = (categoryName: string) => {
    setActiveCategories((previous) => {
      const next = new Set(previous);
      if (next.has(categoryName)) next.delete(categoryName);
      else next.add(categoryName);
      return next;
    });
    setSelectedLocation(null);
  };

  const setAllCategories = () => {
    if (!dataset) return;
    setActiveCategories(new Set(dataset.categories.map((category) => category.name)));
    setSelectedLocation(null);
  };

  const clearCategories = () => {
    setActiveCategories(new Set());
    setSelectedLocation(null);
  };

  const selectLocation = useCallback((location: MapLocation) => {
    setSelectedLocation(location);
  }, []);

  const selectedId = selectedLocation?.id;

  if (loadError) {
    return (
      <main className="load-error">
        <div className="error-card">
          <div className="brand-mark">
            <PinIcon />
          </div>
          <h1>Camping Across America</h1>
          <p>{loadError}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <header className="sidebar-header">
          <div className="brand-row">
            <div className="brand-mark">
              <PinIcon />
            </div>
            <div>
              <p className="eyebrow">Your road-trip map</p>
              <h1>Camping Across America</h1>
            </div>
          </div>
          <p className="intro-copy">
            Campgrounds, travel stops, and parks gathered in one place.
          </p>
        </header>

        <section className="search-section" aria-label="Search map locations">
          <label htmlFor="location-search">Search by city or state</label>
          <div className="search-box">
            <SearchIcon />
            <input
              id="location-search"
              type="search"
              value={search}
              onChange={handleSearchChange}
              placeholder="Try Phoenix, Arizona or CA"
              autoComplete="off"
            />
            {search && (
              <button
                className="clear-search"
                type="button"
                onClick={() => {
                  setSearch("");
                  setSelectedLocation(null);
                }}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </section>

        <section className="category-section" aria-label="Map categories">
          <div className="section-title-row">
            <button
              className="section-title"
              type="button"
              onClick={() => setCategoriesExpanded((expanded) => !expanded)}
              aria-expanded={categoriesExpanded}
            >
              <span>Show on map</span>
              <span className={`chevron ${categoriesExpanded ? "open" : ""}`}>
                ▾
              </span>
            </button>
            <div className="category-actions">
              <button type="button" onClick={setAllCategories}>
                All
              </button>
              <span aria-hidden="true">·</span>
              <button type="button" onClick={clearCategories}>
                None
              </button>
            </div>
          </div>

          {categoriesExpanded && (
            <div className="category-list">
              {dataset?.categories.map((category) => {
                const checked = activeCategories.has(category.name);
                return (
                  <label
                    className={`category-option ${checked ? "checked" : ""}`}
                    key={category.name}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCategory(category.name)}
                      aria-label={`Show ${category.name}`}
                    />
                    <span
                      className="category-dot"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="category-name">{category.name}</span>
                    <span className="category-count">
                      {formatCount(category.count)}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </section>

        <section className="results-section" aria-label="Map results">
          <div className="results-heading">
            <div>
              <h2>Locations</h2>
              <p>
                {formatCount(filteredLocations.length)}{" "}
                {filteredLocations.length === 1 ? "place" : "places"}
                {search.trim() ? " found" : " on the map"}
              </p>
            </div>
            <span className="results-pin">
              <PinIcon />
            </span>
          </div>

          <div className="location-list" ref={listRef}>
            {visibleLocations.map((location) => {
              const selected = selectedId === location.id;
              return (
                <button
                  className={`location-card ${selected ? "selected" : ""}`}
                  type="button"
                  key={location.id}
                  onClick={() => selectLocation(location)}
                >
                  <span
                    className="list-pin"
                    style={{ backgroundColor: location.color }}
                    aria-hidden="true"
                  />
                  <span className="location-copy">
                    <span className="location-name">{location.name}</span>
                    <span className="location-place">
                      {locationSubtitle(location)}
                    </span>
                    <span className="location-category">
                      {location.category}
                    </span>
                  </span>
                  <span className="location-arrow" aria-hidden="true">
                    ›
                  </span>
                </button>
              );
            })}

            {filteredLocations.length === 0 && (
              <div className="empty-results">
                <span className="empty-search-icon">
                  <SearchIcon />
                </span>
                <strong>No matching locations</strong>
                <span>Try another city, state, or category.</span>
              </div>
            )}

            {visibleCount < filteredLocations.length && (
              <button
                className="load-more"
                type="button"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              >
                Show more locations
                <span>
                  {formatCount(Math.min(PAGE_SIZE, filteredLocations.length - visibleCount))}{" "}
                  more
                </span>
              </button>
            )}
          </div>
        </section>

        <footer className="sidebar-footer">
          <span className="footer-dot" />
          <span>
            {dataset ? formatCount(dataset.locations.length) : "…"} locations
            imported
          </span>
          <a
            href={dataset?.source.url}
            target="_blank"
            rel="noreferrer"
            title="Open the original Google My Maps"
          >
            Source map ↗
          </a>
        </footer>
      </aside>

      <section className="map-stage" aria-label="Interactive campground map">
        {!dataset && (
          <div className="map-loading">
            <span className="loading-spinner" />
            <span>Loading your map…</span>
          </div>
        )}
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          minZoom={2}
          maxZoom={18}
          scrollWheelZoom
          preferCanvas
          zoomControl={false}
          className="map-canvas"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          {dataset &&
            filteredLocations.map((location) => (
              <CircleMarker
                key={location.id}
                center={[location.latitude, location.longitude]}
                radius={selectedId === location.id ? 8 : 5}
                pathOptions={{
                  color: selectedId === location.id ? "#ffffff" : location.color,
                  weight: selectedId === location.id ? 3 : 1.5,
                  fillColor: location.color,
                  fillOpacity: 0.92,
                }}
                eventHandlers={{
                  click: (event) => {
                    selectLocation(location);
                    event.target
                      .bindPopup(popupContent(location), {
                        closeButton: true,
                        offset: [0, -4],
                        className: "campground-popup",
                      })
                      .openPopup();
                  },
                }}
              />
            ))}
          <MapFocus
            selectedLocation={selectedLocation}
            locations={filteredLocations}
            search={search}
          />
        </MapContainer>

        <div className="map-status">
          <span className="status-pulse" />
          <span>
            {formatCount(filteredLocations.length)} pins visible
          </span>
          <span className="status-divider" />
          <span>OpenStreetMap</span>
        </div>
      </section>
    </main>
  );
}

export default App;
