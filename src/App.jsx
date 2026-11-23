import { useMemo, useState } from "react";
import DeckGL from "@deck.gl/react";
import {
  PathLayer,
  ScatterplotLayer,
} from "@deck.gl/layers";
import { PathStyleExtension } from "@deck.gl/extensions";
import MapLibreMap from "react-map-gl/maplibre";

import fiberNetworkData from "./data/fiberNetwork.json";

import "maplibre-gl/dist/maplibre-gl.css";
import "./App.css";

const INITIAL_VIEW_STATE = {
  longitude: 35.2,
  latitude: 39.0,
  zoom: 5.8,
  pitch: 0,
  bearing: 0,
};

const OPEN_STREET_MAP_STYLE = {
  version: 8,

  sources: {
    "openstreetmap-tiles": {
      type: "raster",
      tiles: [
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },

  layers: [
    {
      id: "openstreetmap-layer",
      type: "raster",
      source: "openstreetmap-tiles",
      minzoom: 0,
      maxzoom: 19,

      paint: {
        "raster-saturation": -0.7,
        "raster-contrast": -0.15,
        "raster-brightness-min": 0.15,
        "raster-brightness-max": 0.9,
      },
    },
  ],
};

function getLatencyColor(latencyMs) {
  if (latencyMs <= 30) {
    return [34, 197, 94, 255];
  }

  if (latencyMs <= 60) {
    return [245, 158, 11, 255];
  }

  return [239, 68, 68, 255];
}

function getCapacityWidth(capacityTbps) {
  if (capacityTbps >= 8) {
    return 9;
  }

  if (capacityTbps >= 3) {
    return 6;
  }

  return 4;
}

function getCapacityClass(capacityTbps) {
  if (capacityTbps >= 8) {
    return "BACKBONE";
  }

  if (capacityTbps >= 3) {
    return "REGIONAL";
  }

  return "LOCAL";
}

function getCapacityClassLabel(capacityTbps) {
  const capacityClass =
    getCapacityClass(capacityTbps);

  if (capacityClass === "BACKBONE") {
    return "Ana Omurga";
  }

  if (capacityClass === "REGIONAL") {
    return "Bölgesel Hat";
  }

  return "Yerel Bağlantı";
}

function getTypeLabel(type) {
  const typeLabels = {
    BACKBONE: "Ana omurga",
    REGIONAL: "Bölgesel hat",
    URBAN: "Şehir içi hat",
    CROSS_BORDER: "Uluslararası çıkış",
    SUBSEA: "Deniz altı hattı",
  };

  return typeLabels[type] ?? type;
}

function getStatusLabel(status) {
  const statusLabels = {
    HEALTHY: "Sağlıklı bağlantı",
    DEGRADED: "Performansı düşmüş bağlantı",
    OUTAGE: "Bağlantı kesintisi",
    MODERATE: "Orta yoğunluk",
    CRITICAL: "Kritik bağlantı",
  };

  return statusLabels[status] ?? status;
}

function createFiberNodes(lines) {
  const nodeMap = new Map();

  lines.forEach((line) => {
    if (!line.path || line.path.length === 0) {
      return;
    }

    const startPosition = line.path[0];
    const endPosition =
      line.path[line.path.length - 1];

    const startKey = startPosition.join(",");
    const endKey = endPosition.join(",");

    if (!nodeMap.has(startKey)) {
      nodeMap.set(startKey, {
        id: `${line.id}-START`,
        name: `${line.name} başlangıç noktası`,
        position: startPosition,
        region: line.region,
        operator: line.operator,
        nodeType: "Hat başlangıcı",
      });
    }

    if (!nodeMap.has(endKey)) {
      nodeMap.set(endKey, {
        id: `${line.id}-END`,
        name: `${line.name} bitiş noktası`,
        position: endPosition,
        region: line.region,
        operator: line.operator,
        nodeType: "Hat bitişi",
      });
    }
  });

  return Array.from(nodeMap.values());
}

function App() {
  const [selectedRegion, setSelectedRegion] =
    useState("Tümü");

  const regions = useMemo(() => {
    const uniqueRegions = [
      ...new Set(
        fiberNetworkData.map(
          (line) => line.region
        )
      ),
    ];

    return uniqueRegions.sort((a, b) =>
      a.localeCompare(b, "tr")
    );
  }, []);

  const filteredLines = useMemo(() => {
    if (selectedRegion === "Tümü") {
      return fiberNetworkData;
    }

    return fiberNetworkData.filter(
      (line) => line.region === selectedRegion
    );
  }, [selectedRegion]);

  const filteredNodes = useMemo(
    () => createFiberNodes(filteredLines),
    [filteredLines]
  );

  const backboneLines = useMemo(
    () =>
      filteredLines.filter(
        (line) =>
          getCapacityClass(line.capacityTbps) ===
          "BACKBONE"
      ),
    [filteredLines]
  );

  const regionalLines = useMemo(
    () =>
      filteredLines.filter(
        (line) =>
          getCapacityClass(line.capacityTbps) ===
          "REGIONAL"
      ),
    [filteredLines]
  );

  const localLines = useMemo(
    () =>
      filteredLines.filter(
        (line) =>
          getCapacityClass(line.capacityTbps) ===
          "LOCAL"
      ),
    [filteredLines]
  );

  const criticalLineCount = useMemo(
    () =>
      filteredLines.filter(
        (line) =>
          line.status === "CRITICAL" ||
          line.status === "OUTAGE" ||
          line.latencyMs > 60
      ).length,
    [filteredLines]
  );

  const healthyLineCount = useMemo(
    () =>
      filteredLines.filter(
        (line) => line.status === "HEALTHY"
      ).length,
    [filteredLines]
  );

  const averageLatency = useMemo(() => {
    if (filteredLines.length === 0) {
      return 0;
    }

    const totalLatency = filteredLines.reduce(
      (total, line) =>
        total + line.latencyMs,
      0
    );

    return Math.round(
      totalLatency / filteredLines.length
    );
  }, [filteredLines]);

  const dashExtension = new PathStyleExtension({
    dash: true,
  });

  // 8 Tbps ve üzerindeki düz ana omurga hatları
  const backboneLayer = new PathLayer({
    id: `backbone-lines-${selectedRegion}`,
    data: backboneLines,

    getPath: (line) => line.path,
    getColor: (line) =>
      getLatencyColor(line.latencyMs),
    getWidth: (line) =>
      getCapacityWidth(line.capacityTbps),

    widthUnits: "pixels",
    widthMinPixels: 6,
    widthMaxPixels: 11,

    jointRounded: true,
    capRounded: true,

    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 110],
  });

  // 3–7 Tbps arasındaki kesikli bölgesel hatlar
  const regionalLayer = new PathLayer({
    id: `regional-lines-${selectedRegion}`,
    data: regionalLines,

    getPath: (line) => line.path,
    getColor: (line) =>
      getLatencyColor(line.latencyMs),
    getWidth: (line) =>
      getCapacityWidth(line.capacityTbps),

    widthUnits: "pixels",
    widthMinPixels: 4.5,
    widthMaxPixels: 8,

    jointRounded: true,
    capRounded: true,

    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 110],

    extensions: [dashExtension],
    getDashArray: [14, 8],
    dashJustified: false,
  });

  // 3 Tbps altındaki noktalı yerel hatlar
  const localLayer = new PathLayer({
    id: `local-lines-${selectedRegion}`,
    data: localLines,

    getPath: (line) => line.path,
    getColor: (line) =>
      getLatencyColor(line.latencyMs),
    getWidth: (line) =>
      getCapacityWidth(line.capacityTbps),

    widthUnits: "pixels",
    widthMinPixels: 3.5,
    widthMaxPixels: 6,

    jointRounded: true,
    capRounded: true,

    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 110],

    extensions: [dashExtension],
    getDashArray: [1, 9],
    dashJustified: false,
  });

  const fiberNodeLayer = new ScatterplotLayer({
    id: `fiber-network-nodes-${selectedRegion}`,
    data: filteredNodes,

    getPosition: (node) => node.position,

    getRadius: 7,
    radiusUnits: "pixels",
    radiusMinPixels: 5,
    radiusMaxPixels: 9,

    getFillColor: [15, 23, 42, 245],
    getLineColor: [255, 255, 255, 255],

    stroked: true,
    filled: true,

    lineWidthUnits: "pixels",
    getLineWidth: 2,

    pickable: true,
  });

  return (
    <main className="app">
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={{
          minZoom: 4.8,
          maxZoom: 12,
          dragRotate: false,
          touchRotate: false,
        }}
        layers={[
          backboneLayer,
          regionalLayer,
          localLayer,
          fiberNodeLayer,
        ]}
        getCursor={({ isHovering }) =>
          isHovering ? "pointer" : "grab"
        }
        getTooltip={({ object }) => {
          if (!object) {
            return null;
          }

          if (object.position) {
            return {
              html: `
                <div class="fiber-tooltip">
                  <div class="tooltip-title">
                    ${object.name}
                  </div>

                  <div class="tooltip-row">
                    <span>Tür</span>
                    <strong>${object.nodeType}</strong>
                  </div>

                  <div class="tooltip-row">
                    <span>Bölge</span>
                    <strong>${object.region}</strong>
                  </div>

                  <div class="tooltip-row">
                    <span>Operatör</span>
                    <strong>${object.operator}</strong>
                  </div>
                </div>
              `,

              style: {
                backgroundColor:
                  "rgba(15, 23, 42, 0.97)",
                color: "#ffffff",
                borderRadius: "10px",
                padding: "0",
                fontSize: "12px",
              },
            };
          }

          return {
            html: `
              <div class="fiber-tooltip">
                <div class="tooltip-title">
                  ${object.name}
                </div>

                <div class="tooltip-row">
                  <span>Hat kodu</span>
                  <strong>${object.id}</strong>
                </div>

                <div class="tooltip-row">
                  <span>Bölge</span>
                  <strong>${object.region}</strong>
                </div>

                <div class="tooltip-row">
                  <span>Hat türü</span>
                  <strong>
                    ${getTypeLabel(object.type)}
                  </strong>
                </div>

                <div class="tooltip-row">
                  <span>Operatör</span>
                  <strong>${object.operator}</strong>
                </div>

                <div class="tooltip-row">
                  <span>Kapasite sınıfı</span>
                  <strong>
                    ${getCapacityClassLabel(
                      object.capacityTbps
                    )}
                  </strong>
                </div>

                <div class="tooltip-row">
                  <span>Gecikme</span>
                  <strong>
                    ${object.latencyMs} ms
                  </strong>
                </div>

                <div class="tooltip-row">
                  <span>Kapasite</span>
                  <strong>
                    ${object.capacityTbps} Tbps
                  </strong>
                </div>

                <div class="tooltip-status">
                  ${getStatusLabel(object.status)}
                </div>
              </div>
            `,

            style: {
              backgroundColor:
                "rgba(15, 23, 42, 0.97)",
              color: "#ffffff",
              borderRadius: "10px",
              padding: "0",
              fontSize: "12px",
            },
          };
        }}
      >
        <MapLibreMap
          mapStyle={OPEN_STREET_MAP_STYLE}
          reuseMaps
        />
      </DeckGL>

      <section className="info-panel">
        <div className="panel-header">
          <span className="panel-badge">
            NETWORK MONITORING
          </span>

          <h1>Türkiye Fiber Omurga Ağı</h1>

          <p>
            Fiber hatlarının gecikme, kapasite ve
            bağlantı durumlarının coğrafi gösterimi
          </p>
        </div>

        <div className="panel-section filter-section">
          <label
            className="filter-label"
            htmlFor="region-filter"
          >
            Bölge filtresi
          </label>

          <select
            id="region-filter"
            className="region-select"
            value={selectedRegion}
            onChange={(event) =>
              setSelectedRegion(event.target.value)
            }
          >
            <option value="Tümü">
              Tüm bölgeler
            </option>

            {regions.map((region) => (
              <option
                key={region}
                value={region}
              >
                {region}
              </option>
            ))}
          </select>

          <span className="filter-result">
            Gösterilen bölge:{" "}
            <strong>{selectedRegion}</strong>
          </span>
        </div>

        <div className="panel-section">
          <span className="section-title">
            Gecikme durumu
          </span>

          <div className="status-list">
            <div>
              <span className="status-dot good"></span>
              <span>İyi</span>
              <strong>0–30 ms</strong>
            </div>

            <div>
              <span className="status-dot warning"></span>
              <span>Yoğun</span>
              <strong>31–60 ms</strong>
            </div>

            <div>
              <span className="status-dot critical"></span>
              <span>Kritik</span>
              <strong>61+ ms</strong>
            </div>
          </div>
        </div>

        <div className="panel-section">
          <span className="section-title">
            Hat kapasitesi / çizgi tipi
          </span>

          <div className="width-row">
            <span className="sample-line backbone"></span>
            <span>Ana omurga (8+ Tbps)</span>
          </div>

          <div className="width-row">
            <span className="sample-line regional"></span>
            <span>Bölgesel hat (3–7 Tbps)</span>
          </div>

          <div className="width-row">
            <span className="sample-line local"></span>
            <span>Yerel bağlantı (0–2 Tbps)</span>
          </div>
        </div>

        <div className="panel-section">
          <span className="section-title">
            Ağ özeti
          </span>

          <div className="network-summary">
            <div className="summary-row">
              <span>Gösterilen hat</span>
              <strong>{filteredLines.length}</strong>
            </div>

            <div className="summary-row">
              <span>Bağlantı noktası</span>
              <strong>{filteredNodes.length}</strong>
            </div>

            <div className="summary-row">
              <span>Sağlıklı hat</span>
              <strong>{healthyLineCount}</strong>
            </div>

            <div className="summary-row">
              <span>Kritik hat</span>
              <strong>{criticalLineCount}</strong>
            </div>

            <div className="summary-row">
              <span>Ortalama gecikme</span>
              <strong>{averageLatency} ms</strong>
            </div>
          </div>
        </div>

        <div className="panel-footer">
          Bir bölge seçerek yalnızca o bölgedeki
          fiber hatlarını görüntüleyebilirsin.
        </div>
      </section>
    </main>
  );
}

export default App;