import React, { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import { doc, onSnapshot, setDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import "./App.css";
import TotesUsedCard from "./TotesUsedCard";
import BaggedTotesCard from "./BaggedTotesCard";
import PickAndBaggedCombinedCard from "./PickCard";
import ShiftEOSCard from "./ShiftEOSCard";
import FrameloadFreezer from "./FrameloadFreezer";
import BarcodeCard from "./Barcode";
import StaffAllocation from "./staffallocation";
import { Carousel } from "react-responsive-carousel";
import "react-responsive-carousel/lib/styles/carousel.min.css";

const DATADOC = doc(db, "totes", "data");

const CLEAR_DOCUMENTS = [
  doc(db, "totes", "data"),
  doc(db, "totes", "shiftEOS"),
  doc(db, "totes", "pickCalculator"),
  doc(db, "totes", "staffAllocation"),
  doc(db, "totes", "freezerCalc"),
  doc(db, "totes", "barcodeGenerator"),
  doc(db, "totes", "dollies"),
  doc(db, "totes", "dolliesUsed"),
  doc(db, "totes", "totesUsed"),
  doc(db, "totes", "baggedTotes"),
];

function Header({ theme, setTheme }) {
  const themeOptions = [
    { name: "blue", color: "#4a90e2" },
    { name: "red", color: "#d9534f" },
    { name: "yellow", color: "#d4a017" },
    { name: "pink", color: "#d96cb3" },
    { name: "orange", color: "#f28c28" },
  ];

  return (
    <header className="header">
      <h1 className="header-title">Shift Planner</h1>

      <div className="theme-picker">
        {themeOptions.map((item) => (
          <button
            key={item.name}
            type="button"
            className={`theme-dot ${theme === item.name ? "active" : ""}`}
            style={{ backgroundColor: item.color }}
            onClick={() => setTheme(item.name)}
            aria-label={`Switch to ${item.name} theme`}
            title={item.name}
          />
        ))}
      </div>
    </header>
  );
}

function parseToteCell(cell) {
  if (!cell && cell !== 0) return 0;

  const str = String(cell).trim();

  if (!str) return 0;

  const slashMatch = str.match(/^\s*-?\d+\s*\/\s*(-?\d+)\s*$/);

  if (slashMatch) {
    const denominator = parseInt(slashMatch[1], 10);
    return Number.isNaN(denominator) ? 0 : Math.abs(denominator);
  }

  const matches = str.match(/-?\d+/g);

  if (!matches) return 0;

  const numbers = matches
    .map((value) => parseInt(value, 10))
    .filter((value) => !Number.isNaN(value));

  return numbers.length ? Math.abs(numbers[0]) : 0;
}

function normaliseHeader(header) {
  return String(header || "")
    .replace(/\uFEFF/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getColumnKeys(headers) {
  const headerMap = {};

  headers.forEach((header) => {
    headerMap[normaliseHeader(header)] = header;
  });

  const findHeader = (...names) => {
    for (const name of names) {
      const found = headerMap[normaliseHeader(name)];

      if (found) return found;
    }

    return undefined;
  };

  const findMatchingHeader = (pattern) =>
    headers.find((header) => pattern.test(normaliseHeader(header)));

  return {
    consignmentKey:
      findHeader("Consignment") ||
      findMatchingHeader(/consignment/i),

    ambientKey:
      findHeader("Completed Totes - Ambient") ||
      findMatchingHeader(/completed totes.*ambient/i) ||
      findMatchingHeader(/ambient/i),

    chilledKey:
      findHeader("Completed Totes - Chilled") ||
      findMatchingHeader(/completed totes.*chill/i) ||
      findMatchingHeader(/chill|chilled/i),

    freezerKey:
      findHeader("Completed Totes - Freezer") ||
      findMatchingHeader(/completed totes.*freezer/i) ||
      findMatchingHeader(/freezer/i),

    shipmentKey:
      findHeader("Shipment") ||
      findMatchingHeader(/^shipment$/i),

    shipmentTypeKey:
      findHeader("Shipment type") ||
      findMatchingHeader(/^shipment type$/i),

    dispatchKey:
      findHeader("Dispatch time") ||
      findMatchingHeader(/^dispatch time$/i) ||
      findMatchingHeader(/dispatch.*time/i),
  };
}

function getRouteName(row, shipmentKey, shipmentTypeKey, dispatchKey) {
  const shipment = String(row[shipmentKey] || "").trim();
  const shipmentType = String(row[shipmentTypeKey] || "").trim();
  const dispatch = String(row[dispatchKey] || "").trim();

  /*
    CSV direct deliveries have Shipment values such as:
    route-741362

    These must stay in the Vans group, even when they have
    a time that could otherwise match a spoke.
  */
  if (
    /^route[-\s]?\d+/i.test(shipment) ||
    /\broute[-\s]?\d+/i.test(shipment) ||
    /\bdirect\b/i.test(shipmentType)
  ) {
    return "Vans";
  }

  /*
    Spoke rows in the CSV are identified as:
    Transfer (Etobicoke Voila Spoke)

    The time is included in Dispatch time, for example:
    2026-10-05, 03:30
    2026-10-05, 04:40
  */
  const isSpokeTransfer =
    /\bspoke\b/i.test(shipmentType) ||
    /\btransfer\b/i.test(shipmentType);

  const allTimes = dispatch.match(/\b\d{1,2}:\d{2}\b/g);
  const rawTime = allTimes?.[allTimes.length - 1];

  if (!rawTime) {
    return isSpokeTransfer ? "Spoke" : "Vans";
  }

  const [hourText, minuteText] = rawTime.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return isSpokeTransfer ? "Spoke" : "Vans";
  }

  const time = `${String(hour).padStart(2, "0")}:${String(
    minute
  ).padStart(2, "0")}`;

  const spokeTimes = {
    "23:15": "Ottawa Spoke",
    "23:16": "Ottawa Spoke",
    "23:17": "Ottawa Spoke",
    "02:30": "2:30 Etobicoke Spoke",
    "03:30": "3:30 Etobicoke Spoke",
    "04:40": "4:40 Etobicoke Spoke",
    "09:30": "9:30 Etobicoke Spoke",
    "10:00": "10:00 Etobicoke Spoke",
  };

  if (spokeTimes[time]) {
    return spokeTimes[time];
  }

  return isSpokeTransfer ? "Spoke" : "Vans";
}

export default function App() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [routesInfo, setRoutesInfo] = useState({});
  const [grandTotals, setGrandTotals] = useState({
    ambient: 0,
    chilled: 0,
    freezer: 0,
    total: 0,
  });
  const [duplicateMessage, setDuplicateMessage] = useState("");
  const [slideIndex, setSlideIndex] = useState(0);
  const [theme, setTheme] = useState("blue");
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [clearAllMessage, setClearAllMessage] = useState("");

  const rowsRef = useRef([]);
  const clearAllTimerRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    const unsubscribe = onSnapshot(DATADOC, (snapshot) => {
      const savedRows = snapshot.exists() ? snapshot.data().rows || [] : [];

      const nextRoutesInfo = {};
      const nextGrandTotals = {
        ambient: 0,
        chilled: 0,
        freezer: 0,
        total: 0,
      };

      savedRows.forEach((row) => {
        const route = row.route || "Spoke";

        if (!nextRoutesInfo[route]) {
          nextRoutesInfo[route] = {
            totals: {
              ambient: 0,
              chilled: 0,
              freezer: 0,
              total: 0,
            },
            rows: [],
          };
        }

        const ambient = Number(row.ambient) || 0;
        const chilled = Number(row.chilled) || 0;
        const freezer = Number(row.freezer) || 0;
        const total = ambient + chilled + freezer;

        nextRoutesInfo[route].totals.ambient += ambient;
        nextRoutesInfo[route].totals.chilled += chilled;
        nextRoutesInfo[route].totals.freezer += freezer;
        nextRoutesInfo[route].totals.total += total;
        nextRoutesInfo[route].rows.push(row);

        nextGrandTotals.ambient += ambient;
        nextGrandTotals.chilled += chilled;
        nextGrandTotals.freezer += freezer;
        nextGrandTotals.total += total;
      });

      setRows(savedRows);
      setRoutesInfo(nextRoutesInfo);
      setGrandTotals(nextGrandTotals);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!clearAllMessage) return undefined;

    if (clearAllTimerRef.current) {
      clearTimeout(clearAllTimerRef.current);
    }

    clearAllTimerRef.current = setTimeout(() => {
      setClearAllMessage("");
      clearAllTimerRef.current = null;
    }, 3000);

    return () => {
      if (clearAllTimerRef.current) {
        clearTimeout(clearAllTimerRef.current);
      }
    };
  }, [clearAllMessage]);

  const handleFiles = (files) => {
    Array.from(files).forEach((file) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.replace(/\uFEFF/g, "").trim(),

        complete: async (results) => {
          const dataRows = results.data || [];

          if (!dataRows.length) return;

          const headers = Object.keys(dataRows[0]);

          const {
            consignmentKey,
            ambientKey,
            chilledKey,
            freezerKey,
            shipmentKey,
            shipmentTypeKey,
            dispatchKey,
          } = getColumnKeys(headers);

          /*
            Important validation. If this message appears, the CSV header
            has changed and we can immediately see which column is missing.
          */
          if (!consignmentKey || !dispatchKey) {
            console.error("CSV headers found:", headers);

            setDuplicateMessage(
              "CSV could not find Consignment or Dispatch time column"
            );

            return;
          }

          const latestRows = rowsRef.current;
          const knownConsignments = new Set(
            latestRows.map((row) =>
              String(row.consignment || "").trim().toLowerCase()
            )
          );

          const newRows = [];
          let duplicatesDetected = 0;

          dataRows.forEach((row) => {
            const consignment = String(row[consignmentKey] || "").trim();
            const consignmentKeyNormalised = consignment.toLowerCase();

            if (!consignment || knownConsignments.has(consignmentKeyNormalised)) {
              if (consignment) duplicatesDetected += 1;
              return;
            }

            knownConsignments.add(consignmentKeyNormalised);

            const route = getRouteName(
              row,
              shipmentKey,
              shipmentTypeKey,
              dispatchKey
            );

            newRows.push({
              consignment,
              route,
              shipment: shipmentKey
                ? String(row[shipmentKey] || "").trim()
                : "",
              shipmentType: shipmentTypeKey
                ? String(row[shipmentTypeKey] || "").trim()
                : "",
              dispatchTime: String(row[dispatchKey] || "").trim(),
              ambient: ambientKey ? parseToteCell(row[ambientKey]) : 0,
              chilled: chilledKey ? parseToteCell(row[chilledKey]) : 0,
              freezer: freezerKey ? parseToteCell(row[freezerKey]) : 0,
            });
          });

          if (duplicatesDetected > 0) {
            setDuplicateMessage(
              `${duplicatesDetected} duplicate line${
                duplicatesDetected > 1 ? "s" : ""
              } ignored`
            );
          }

          if (!newRows.length) return;

          try {
            await setDoc(
              DATADOC,
              {
                rows: [...latestRows, ...newRows],
              },
              { merge: true }
            );
          } catch (error) {
            console.error("Firestore upload error:", error);
          }
        },

        error: (error) => {
          console.error("CSV parsing error:", error);
          setDuplicateMessage("Could not read CSV file");
        },
      });
    });
  };

  const onFileChange = (event) => {
    if (!event.target.files.length) return;

    handleFiles(event.target.files);
    event.target.value = null;
  };

  const clearAll = async () => {
    try {
      await setDoc(DATADOC, { rows: [] }, { merge: true });
      setDuplicateMessage("");
    } catch (error) {
      console.error("Clear uploaded data error:", error);
    }
  };

  const clearEverything = async () => {
    const confirmed = window.confirm(
      "Clear all slides and all saved Firebase data? This cannot be undone."
    );

    if (!confirmed) return;

    setIsClearingAll(true);
    setClearAllMessage("");

    try {
      const uniqueDocuments = Array.from(
        new Map(
          CLEAR_DOCUMENTS.map((documentReference) => [
            documentReference.path,
            documentReference,
          ])
        ).values()
      );

      const batch = writeBatch(db);

      uniqueDocuments.forEach((documentReference) => {
        batch.set(documentReference, {});
      });

      await batch.commit();

      window.dispatchEvent(
        new CustomEvent("shift-planner-clear-all", {
          detail: {
            clearedAt: Date.now(),
          },
        })
      );

      setRows([]);
      setRoutesInfo({});
      setGrandTotals({
        ambient: 0,
        chilled: 0,
        freezer: 0,
        total: 0,
      });
      setDuplicateMessage("");
      setSlideIndex(0);
      setClearAllMessage("All slides and Firebase data cleared");
    } catch (error) {
      console.error("Clear all Firebase data error:", error);
      setClearAllMessage("Could not clear all saved data");
    } finally {
      setIsClearingAll(false);
    }
  };

  const deleteRoutesFromRoute = async (
    routeName,
    amount,
    deleteAllRows = false
  ) => {
    const routeRows = rows.filter((row) => row.route === routeName);

    if (!routeRows.length) return;

    const numberToDelete = deleteAllRows
      ? routeRows.length
      : Math.min(
          Math.max(parseInt(amount, 10) || 0, 0),
          routeRows.length
        );

    if (!numberToDelete) return;

    const consignmentsToDelete = new Set(
      routeRows.slice(-numberToDelete).map((row) => row.consignment)
    );

    const updatedRows = rows.filter(
      (row) => !consignmentsToDelete.has(row.consignment)
    );

    try {
      await setDoc(DATADOC, { rows: updatedRows }, { merge: true });
      setDuplicateMessage("");
    } catch (error) {
      console.error("Delete route data error:", error);
    }
  };

  const deleteConsignment = async (consignment) => {
    const normalised = String(consignment || "").trim().toLowerCase();

    if (!normalised) return false;

    const updatedRows = rows.filter(
      (row) =>
        String(row.consignment || "").trim().toLowerCase() !== normalised
    );

    if (updatedRows.length === rows.length) return false;

    try {
      await setDoc(DATADOC, { rows: updatedRows }, { merge: true });
      setDuplicateMessage("");
      return true;
    } catch (error) {
      console.error("Delete consignment error:", error);
      return false;
    }
  };

  if (loading) {
    return <p className="app-loading">Loading...</p>;
  }

  return (
    <div className="app-container">
      <Header theme={theme} setTheme={setTheme} />

      <main className="app-main">
        <div className="app-shell">
          <div className="app-layout">
            <aside className="sidebar-nav" aria-label="Calculator sections">
              <nav className="carousel-links">
                <button
                  type="button"
                  onClick={() => setSlideIndex(0)}
                  className={slideIndex === 0 ? "active" : ""}
                >
                  Shift EOS
                </button>

                <button
                  type="button"
                  onClick={() => setSlideIndex(1)}
                  className={slideIndex === 1 ? "active" : ""}
                >
                  Staff Allocation
                </button>

                <button
                  type="button"
                  onClick={() => setSlideIndex(2)}
                  className={slideIndex === 2 ? "active" : ""}
                >
                  Totes Used
                </button>

                <button
                  type="button"
                  onClick={() => setSlideIndex(3)}
                  className={slideIndex === 3 ? "active" : ""}
                >
                  Bagged Totes
                </button>

                <button
                  type="button"
                  onClick={() => setSlideIndex(4)}
                  className={slideIndex === 4 ? "active" : ""}
                >
                  Pick Calculator
                </button>

                <button
                  type="button"
                  onClick={() => setSlideIndex(5)}
                  className={slideIndex === 5 ? "active" : ""}
                >
                  Frameload/Freezer
                </button>

                <button
                  type="button"
                  onClick={() => setSlideIndex(6)}
                  className={slideIndex === 6 ? "active" : ""}
                >
                  Barcode Generator
                </button>
              </nav>

              <button
                type="button"
                className="sidebar-clear-all-btn"
                onClick={clearEverything}
                disabled={isClearingAll}
              >
                {isClearingAll ? "Clearing..." : "Clear All"}
              </button>
            </aside>

            <section className="carousel-panel">
              <div className="carousel-container">
                <Carousel
                  selectedItem={slideIndex}
                  onChange={setSlideIndex}
                  showThumbs={false}
                  showStatus={false}
                  showIndicators={false}
                  infiniteLoop={false}
                  swipeable
                  emulateTouch={false}
                >
                  <div className="carousel-slide">
                    <div className="slide-scroll-area">
                      <ShiftEOSCard />
                    </div>
                  </div>

                  <div className="carousel-slide">
                    <div className="slide-scroll-area">
                      <StaffAllocation />
                    </div>
                  </div>

                  <div className="carousel-slide">
                    <div className="slide-scroll-area">
                      <TotesUsedCard
                        rows={rows}
                        routesInfo={routesInfo}
                        grandTotals={grandTotals}
                        duplicateMessage={duplicateMessage}
                        onFileChange={onFileChange}
                        clearAll={clearAll}
                        deleteRoutesFromRoute={deleteRoutesFromRoute}
                        deleteConsignment={deleteConsignment}
                      />
                    </div>
                  </div>

                  <div className="carousel-slide">
                    <div className="slide-scroll-area">
                      <BaggedTotesCard grandTotals={grandTotals} />
                    </div>
                  </div>

                  <div className="carousel-slide">
                    <div className="slide-scroll-area">
                      <PickAndBaggedCombinedCard />
                    </div>
                  </div>

                  <div className="carousel-slide">
                    <div className="slide-scroll-area">
                      <FrameloadFreezer grandTotals={grandTotals} />
                    </div>
                  </div>

                  <div className="carousel-slide">
                    <div className="slide-scroll-area">
                      <BarcodeCard />
                    </div>
                  </div>
                </Carousel>
              </div>
            </section>
          </div>
        </div>
      </main>

      {clearAllMessage && (
        <div className="toast-notification-center">{clearAllMessage}</div>
      )}
    </div>
  );
}