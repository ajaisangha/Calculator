import React, { useState, useEffect } from "react";
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

/*
  Each listed document is overwritten with an empty object.
  Keep names that your components use. Duplicate-safe references
  are filtered before the Firestore batch is written.
*/
const CLEAR_DOCUMENTS = [
  doc(db, "totes", "data"),
  doc(db, "totes", "shiftEOS"),
  doc(db, "totes", "pickCalculator"),
  doc(db, "totes", "staffAllocation"),
  doc(db, "totes", "frameloadFreezer"),
  doc(db, "totes", "barcode"),

  // Common alternate document names for the visible slide data.
  doc(db, "totes", "dollies"),
  doc(db, "totes", "dolliesUsed"),
  doc(db, "totes", "totesUsed"),
  doc(db, "totes", "baggedTotes"),
  doc(db, "totes", "frameload"),
  doc(db, "totes", "freezer"),
  doc(db, "totes", "frameloadFreezerData"),
  doc(db, "totes", "barcodeGenerator"),
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

  const nums = matches
    .map((number) => parseInt(number, 10))
    .filter((number) => !Number.isNaN(number));

  return nums.length ? Math.abs(nums[0]) : 0;
}

function getColumnKeys(headers) {
  const pickCol = (pattern) =>
    headers.find((header) => new RegExp(pattern, "i").test(header));

  return {
    consignmentKey: pickCol("^Consignment$") || pickCol("consignment"),
    ambientKey: pickCol("Completed.*Totes.*Ambient") || pickCol("ambient"),
    chilledKey:
      pickCol("Completed.*Totes.*Chill") || pickCol("chill|chilled"),
    freezerKey: pickCol("Completed.*Totes.*Freezer") || pickCol("freezer"),
    shipmentKey: pickCol("^Shipment$") || pickCol("shipment"),
    dispatchKey:
      pickCol("Dispatch time") ||
      pickCol("dispatch time") ||
      pickCol("Dispatch Time"),
  };
}

function getRouteName(row, shipmentKey, dispatchKey) {
  const shipment = String(row[shipmentKey] || "").trim();
  const dispatch = String(row[dispatchKey] || "").trim();

  if (/route[-\s]?/i.test(shipment) || /\bvans?\b/i.test(shipment)) {
    return "Vans";
  }

  const timeMatch = dispatch.match(/(?:,\s*)?(\d{1,2}:\d{2})\s*$/);
  const dispatchTime = timeMatch ? timeMatch[1] : null;

  if (!dispatchTime) return "Spoke";

  if (["23:15", "23:16", "23:17"].includes(dispatchTime)) {
    return "Ottawa Spoke";
  }

  if (dispatchTime === "02:30" || dispatchTime === "2:30") {
    return "2:30 Etobicoke Spoke";
  }

  if (dispatchTime === "03:00" || dispatchTime === "3:00") {
    return "3:00 Etobicoke Spoke";
  }

  if (dispatchTime === "05:30" || dispatchTime === "5:30") {
    return "5:30 Etobicoke Spoke";
  }

  if (dispatchTime === "09:30" || dispatchTime === "9:30") {
    return "9:30 Etobicoke Spoke";
  }

  if (dispatchTime === "10:00") {
    return "10:00 Etobicoke Spoke";
  }

  return "Spoke";
}

export default function App() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [consignmentSet, setConsignmentSet] = useState(new Set());
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

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    const unsubscribe = onSnapshot(DATADOC, (docSnap) => {
      if (docSnap.exists()) {
        const savedRows = docSnap.data().rows || [];

        setRows(savedRows);
        setConsignmentSet(new Set(savedRows.map((row) => row.consignment)));

        const routeMap = {};
        const grand = {
          ambient: 0,
          chilled: 0,
          freezer: 0,
          total: 0,
        };

        savedRows.forEach((row) => {
          if (!routeMap[row.route]) {
            routeMap[row.route] = {
              totals: {
                ambient: 0,
                chilled: 0,
                freezer: 0,
                total: 0,
              },
              rows: [],
            };
          }

          routeMap[row.route].totals.ambient += row.ambient;
          routeMap[row.route].totals.chilled += row.chilled;
          routeMap[row.route].totals.freezer += row.freezer;
          routeMap[row.route].totals.total +=
            row.ambient + row.chilled + row.freezer;
          routeMap[row.route].rows.push(row);

          grand.ambient += row.ambient;
          grand.chilled += row.chilled;
          grand.freezer += row.freezer;
          grand.total = grand.ambient + grand.chilled + grand.freezer;
        });

        setRoutesInfo(routeMap);
        setGrandTotals(grand);
      } else {
        setRows([]);
        setConsignmentSet(new Set());
        setRoutesInfo({});
        setGrandTotals({
          ambient: 0,
          chilled: 0,
          freezer: 0,
          total: 0,
        });
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!clearAllMessage) return undefined;

    const timer = setTimeout(() => {
      setClearAllMessage("");
    }, 3000);

    return () => clearTimeout(timer);
  }, [clearAllMessage]);

  const handleFiles = (files) => {
    Array.from(files).forEach((file) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        complete: async (results) => {
          const dataRows = results.data;

          if (!dataRows.length) return;

          const headers = Object.keys(dataRows[0]);

          const {
            consignmentKey,
            ambientKey,
            chilledKey,
            freezerKey,
            shipmentKey,
            dispatchKey,
          } = getColumnKeys(headers);

          const latestRows = rows;
          const newRows = [];
          const newConsignments = new Set(
            latestRows.map((row) => row.consignment)
          );

          let duplicatesDetected = 0;

          dataRows.forEach((row) => {
            const consignment = String(row[consignmentKey] || "").trim();

            if (!consignment || newConsignments.has(consignment)) {
              if (consignment) duplicatesDetected += 1;
              return;
            }

            newConsignments.add(consignment);

            const route = getRouteName(row, shipmentKey, dispatchKey);

            newRows.push({
              consignment,
              route,
              shipment: shipmentKey
                ? String(row[shipmentKey] || "").trim()
                : "",
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

            setTimeout(() => setDuplicateMessage(""), 5000);
          }

          if (newRows.length) {
            try {
              await setDoc(
                DATADOC,
                { rows: [...latestRows, ...newRows] },
                { merge: true }
              );
            } catch (err) {
              console.error("Firestore upload error:", err);
            }
          }
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
    } catch (err) {
      console.error("Clear uploaded data error:", err);
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

      /*
        The custom event clears local state inside mounted components,
        including inputs and tables that have not yet updated from
        their Firestore snapshot listeners.
      */
      window.dispatchEvent(
        new CustomEvent("shift-planner-clear-all", {
          detail: {
            clearedAt: Date.now(),
          },
        })
      );

      setRows([]);
      setConsignmentSet(new Set());
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
    } catch (err) {
      console.error("Clear all Firebase data error:", err);
      setClearAllMessage("Could not clear all saved data");
    } finally {
      setIsClearingAll(false);
    }
  };

  const deleteRoutesFromRoute = async (
    routeName,
    amount,
    deleteAll = false
  ) => {
    const routeRows = rows.filter((row) => row.route === routeName);

    if (!routeRows.length) return;

    const numberToDelete = deleteAll
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
    } catch (err) {
      console.error("Delete route data error:", err);
    }
  };

  const deleteConsignment = async (consignment) => {
    const normalizedConsignment = String(consignment || "")
      .trim()
      .toLowerCase();

    if (!normalizedConsignment) {
      return false;
    }

    const matchedRow = rows.find(
      (row) =>
        String(row.consignment || "").trim().toLowerCase() ===
        normalizedConsignment
    );

    if (!matchedRow) {
      return false;
    }

    const updatedRows = rows.filter(
      (row) =>
        String(row.consignment || "").trim().toLowerCase() !==
        normalizedConsignment
    );

    try {
      await setDoc(DATADOC, { rows: updatedRows }, { merge: true });
      setDuplicateMessage("");
      return true;
    } catch (err) {
      console.error("Delete consignment error:", err);
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