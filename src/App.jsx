import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import { doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "./firebase";
import "./App.css";
import TotesUsedCard from "./TotesUsedCard";
import BaggedTotesCard from "./BaggedTotesCard";
import PickAndBaggedCombinedCard from "./PickCard";
import ShiftEOSCard from "./ShiftEOSCard";
import FreezerCard from "./FreezerCard";
import { Carousel } from "react-responsive-carousel";
import "react-responsive-carousel/lib/styles/carousel.min.css";

const DATADOC = doc(db, "totes", "data");

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
      <h1 className="header-title">Calculator</h1>

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

  const matches = str.match(/-?\d+/g);
  if (!matches) return 0;

  const nums = matches
    .map((n) => parseInt(n, 10))
    .filter((n) => !Number.isNaN(n));

  return nums.length ? Math.max(...nums.map(Math.abs), 0) : 0;
}

function getColumnKeys(headers) {
  const pickCol = (pattern) => headers.find((h) => new RegExp(pattern, "i").test(h));

  return {
    consignmentKey: pickCol("^Consignment$") || pickCol("consignment"),
    ambientKey: pickCol("Completed.*Totes.*Ambient") || pickCol("ambient"),
    chilledKey: pickCol("Completed.*Totes.*Chill") || pickCol("chill|chilled"),
    freezerKey: pickCol("Completed.*Totes.*Freezer") || pickCol("freezer"),
    shipmentKey: pickCol("^Shipment$") || pickCol("shipment"),
    dispatchKey: pickCol("Dispatch time") || pickCol("dispatch time") || pickCol("Dispatch Time"),
  };
}

function getRouteName(row, shipmentKey, dispatchKey) {
  const shipment = String(row[shipmentKey] || "").trim();
  const dispatch = String(row[dispatchKey] || "").trim();

  if (/route[-\s]?/i.test(shipment) || /\bvans?\b/i.test(shipment)) return "Vans";

  const timeMatch = dispatch.match(/(?:,\s*)?(\d{1,2}:\d{2})\s*$/);
  const dispatchTime = timeMatch ? timeMatch[1] : null;

  if (!dispatchTime) return "Spoke";

  if (["11:15", "11:16", "11:17"].includes(dispatchTime)) return "Ottawa Spoke";
  if (dispatchTime === "02:30" || dispatchTime === "2:30") return "2:30 Etobicoke Spoke";
  if (dispatchTime === "03:00" || dispatchTime === "3:00") return "3:00 Etobicoke Spoke";
  if (dispatchTime === "05:30" || dispatchTime === "5:30") return "5:30 Etobicoke Spoke";
  if (dispatchTime === "08:45" || dispatchTime === "8:45") return "8:45 Etobicoke Spoke";
  if (dispatchTime === "09:15" || dispatchTime === "9:15") return "9:15 Etobicoke Spoke";

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

  const [receivedAmbient, setReceivedAmbient] = useState("");
  const [receivedChill, setReceivedChill] = useState("");
  const [currentAmbient, setCurrentAmbient] = useState("");
  const [currentChill, setCurrentChill] = useState("");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    const unsubscribe = onSnapshot(DATADOC, (docSnap) => {
      if (docSnap.exists()) {
        const savedRows = docSnap.data().rows || [];
        setRows(savedRows);
        setConsignmentSet(new Set(savedRows.map((r) => r.consignment)));

        const routeMap = {};
        const grand = { ambient: 0, chilled: 0, freezer: 0, total: 0 };

        savedRows.forEach((r) => {
          if (!routeMap[r.route]) {
            routeMap[r.route] = {
              totals: { ambient: 0, chilled: 0, freezer: 0, total: 0 },
              rows: [],
            };
          }

          routeMap[r.route].totals.ambient += r.ambient;
          routeMap[r.route].totals.chilled += r.chilled;
          routeMap[r.route].totals.freezer += r.freezer;
          routeMap[r.route].totals.total += r.ambient + r.chilled + r.freezer;
          routeMap[r.route].rows.push(r);

          grand.ambient += r.ambient;
          grand.chilled += r.chilled;
          grand.freezer += r.freezer;
          grand.total = grand.ambient + grand.chilled + grand.freezer;
        });

        setRoutesInfo(routeMap);
        setGrandTotals(grand);
      } else {
        setRows([]);
        setConsignmentSet(new Set());
        setRoutesInfo({});
        setGrandTotals({ ambient: 0, chilled: 0, freezer: 0, total: 0 });
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleFiles = (files) => {
    Array.from(files).forEach((file) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
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

          const newRows = [];
          const newConsignments = new Set(consignmentSet);
          let duplicatesDetected = 0;

          dataRows.forEach((r) => {
            const consignment = (r[consignmentKey] || "").trim();
            if (!consignment || newConsignments.has(consignment)) {
              if (consignment) duplicatesDetected++;
              return;
            }

            newConsignments.add(consignment);
            const route = getRouteName(r, shipmentKey, dispatchKey);

            newRows.push({
              consignment,
              route,
              ambient: ambientKey ? parseToteCell(r[ambientKey]) : 0,
              chilled: chilledKey ? parseToteCell(r[chilledKey]) : 0,
              freezer: freezerKey ? parseToteCell(r[freezerKey]) : 0,
            });
          });

          if (duplicatesDetected > 0) {
            setDuplicateMessage(
              `${duplicatesDetected} duplicate line${duplicatesDetected > 1 ? "s" : ""} ignored`
            );
            setTimeout(() => setDuplicateMessage(""), 5000);
          }

          if (newRows.length) {
            try {
              await setDoc(DATADOC, { rows: [...rows, ...newRows] });
            } catch (err) {
              console.error("Firestore upload error:", err);
            }
          }
        },
      });
    });
  };

  const onFileChange = (e) => {
    if (!e.target.files.length) return;
    handleFiles(e.target.files);
    e.target.value = null;
  };

  const clearAll = async () => {
    try {
      await deleteDoc(DATADOC);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <p className="app-loading">Loading...</p>;

  return (
    <div className="app-container">
      <Header theme={theme} setTheme={setTheme} />

      <main className="app-main">
        <div className="app-shell">
          <div className="app-layout">
            <aside className="sidebar-nav" aria-label="Calculator sections">
              <nav className="carousel-links">
                <button onClick={() => setSlideIndex(0)} className={slideIndex === 0 ? "active" : ""}>
                  Totes Used
                </button>
                <button onClick={() => setSlideIndex(1)} className={slideIndex === 1 ? "active" : ""}>
                  Bagged Totes
                </button>
                <button onClick={() => setSlideIndex(2)} className={slideIndex === 2 ? "active" : ""}>
                  Pick Calculator
                </button>
                <button onClick={() => setSlideIndex(3)} className={slideIndex === 3 ? "active" : ""}>
                  Shift EOS
                </button>
                <button onClick={() => setSlideIndex(4)} className={slideIndex === 4 ? "active" : ""}>
                  Freezer Calculator
                </button>
              </nav>
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
                  emulateTouch
                >
                  <div className="carousel-slide">
                    <TotesUsedCard
                      rows={rows}
                      routesInfo={routesInfo}
                      grandTotals={grandTotals}
                      duplicateMessage={duplicateMessage}
                      onFileChange={onFileChange}
                      clearAll={clearAll}
                    />
                  </div>

                  <div className="carousel-slide">
                    <BaggedTotesCard
                      grandTotals={grandTotals}
                      receivedAmbient={receivedAmbient}
                      receivedChill={receivedChill}
                      currentAmbient={currentAmbient}
                      currentChill={currentChill}
                      setReceivedAmbient={setReceivedAmbient}
                      setReceivedChill={setReceivedChill}
                      setCurrentAmbient={setCurrentAmbient}
                      setCurrentChill={setCurrentChill}
                    />
                  </div>

                  <div className="carousel-slide">
                    <PickAndBaggedCombinedCard />
                  </div>

                  <div className="carousel-slide">
                    <ShiftEOSCard />
                  </div>

                  <div className="carousel-slide">
                    <FreezerCard />
                  </div>
                </Carousel>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}