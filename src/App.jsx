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

/*
  Exact Firestore documents used by the visible application cards.
  freezerCalc is used by FrameloadFreezer.jsx.
  shiftEOS is used by ShiftEOSCard.jsx.
*/
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

function ConfirmClearModal({ isOpen, isClearing, onCancel, onConfirm }) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isClearing) {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isClearing, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="clear-all-modal-backdrop"
      role="presentation"
      onMouseDown={() => {
        if (!isClearing) onCancel();
      }}
    >
      <section
        className="clear-all-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clear-all-modal-title"
        aria-describedby="clear-all-modal-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="clear-all-modal-title">Clear all data?</h2>

        <p id="clear-all-modal-description">
          This will clear every slide, including Shift EOS hours, Staff
          Allocation, uploaded totes, Pick Calculator, Frameload, Freezer, and
          Barcode data. This action cannot be undone.
        </p>

        <div className="clear-all-modal-actions">
          <button
            type="button"
            className="clear-all-modal-cancel"
            onClick={onCancel}
            disabled={isClearing}
          >
            Cancel
          </button>

          <button
            type="button"
            className="clear-all-modal-confirm"
            onClick={onConfirm}
            disabled={isClearing}
            autoFocus
          >
            {isClearing ? "Clearing..." : "Clear Everything"}
          </button>
        </div>
      </section>
    </div>
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
    .map((number) => parseInt(number, 10))
    .filter((number) => !Number.isNaN(number));

  return numbers.length ? Math.abs(numbers[0]) : 0;
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
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
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
    const unsubscribe = onSnapshot(DATADOC, (docSnap) => {
      if (docSnap.exists()) {
        const savedRows = docSnap.data().rows || [];
        const routeMap = {};
        const grand = { ambient: 0, chilled: 0, freezer: 0, total: 0 };

        savedRows.forEach((row) => {
          if (!routeMap[row.route]) {
            routeMap[row.route] = {
              totals: { ambient: 0, chilled: 0, freezer: 0, total: 0 },
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

        setRows(savedRows);
        setRoutesInfo(routeMap);
        setGrandTotals(grand);
      } else {
        setRows([]);
        setRoutesInfo({});
        setGrandTotals({ ambient: 0, chilled: 0, freezer: 0, total: 0 });
      }

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

          const latestRows = rowsRef.current;
          const newRows = [];
          const knownConsignments = new Set(
            latestRows.map((row) => row.consignment)
          );

          let duplicatesDetected = 0;

          dataRows.forEach((row) => {
            const consignment = String(row[consignmentKey] || "").trim();

            if (!consignment || knownConsignments.has(consignment)) {
              if (consignment) duplicatesDetected += 1;
              return;
            }

            knownConsignments.add(consignment);

            newRows.push({
              consignment,
              route: getRouteName(row, shipmentKey, dispatchKey),
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
          }

          if (!newRows.length) return;

          try {
            await setDoc(
              DATADOC,
              { rows: [...latestRows, ...newRows] },
              { merge: true }
            );
          } catch (error) {
            console.error("Firestore upload error:", error);
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
    } catch (error) {
      console.error("Clear uploaded data error:", error);
    }
  };

  const openClearAllModal = () => {
    if (!isClearingAll) {
      setIsClearAllModalOpen(true);
    }
  };

  const closeClearAllModal = () => {
    if (!isClearingAll) {
      setIsClearAllModalOpen(false);
    }
  };

  const clearEverything = async () => {
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
        Clears private local React state in each mounted card immediately.
        The exact document state is cleared by the Firestore batch above.
      */
      window.dispatchEvent(
        new CustomEvent("shift-planner-clear-all", {
          detail: { clearedAt: Date.now() },
        })
      );

      setRows([]);
      setRoutesInfo({});
      setGrandTotals({ ambient: 0, chilled: 0, freezer: 0, total: 0 });
      setDuplicateMessage("");
      setSlideIndex(0);
      setIsClearAllModalOpen(false);
      setClearAllMessage("All slides and Firebase data cleared");
    } catch (error) {
      console.error("Clear all Firebase data error:", error);
      setClearAllMessage("Could not clear all saved data");
    } finally {
      setIsClearingAll(false);
    }
  };

  const deleteRoutesFromRoute = async (routeName, amount, deleteAllRows = false) => {
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
    const normalizedConsignment = String(consignment || "")
      .trim()
      .toLowerCase();

    if (!normalizedConsignment) return false;

    const updatedRows = rows.filter(
      (row) =>
        String(row.consignment || "").trim().toLowerCase() !==
        normalizedConsignment
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
                onClick={openClearAllModal}
                disabled={isClearingAll}
              >
                Clear All
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

      <ConfirmClearModal
        isOpen={isClearAllModalOpen}
        isClearing={isClearingAll}
        onCancel={closeClearAllModal}
        onConfirm={clearEverything}
      />

      {clearAllMessage && (
        <div className="toast-notification-center">{clearAllMessage}</div>
      )}
    </div>
  );
}
