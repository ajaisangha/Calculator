import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import "./App.css";
import "./pick.css";

const PICK_DOC = doc(db, "totes", "pickCalculator");

const HISTORY_SLOTS = [
  "8PM - 9PM",
  "9PM - 10PM",
  "10PM - 11PM",
  "12am - 1am",
  "1am - 2am",
  "3am - 4am",
  "4am - 5am",
];

const HISTORY_ZONES = ["ambient", "chill"];
const SHIFT_OPTIONS = ["night", "day"];

const createEmptyZoneHistory = () => ({
  ambient: {
    "8PM - 9PM": { uph: "", pickers: "" },
    "9PM - 10PM": { uph: "", pickers: "" },
    "10PM - 11PM": { uph: "", pickers: "" },
    "12am - 1am": { uph: "", pickers: "" },
    "1am - 2am": { uph: "", pickers: "" },
    "3am - 4am": { uph: "", pickers: "" },
    "4am - 5am": { uph: "", pickers: "" },
  },
  chill: {
    "8PM - 9PM": { uph: "", pickers: "" },
    "9PM - 10PM": { uph: "", pickers: "" },
    "10PM - 11PM": { uph: "", pickers: "" },
    "12am - 1am": { uph: "", pickers: "" },
    "1am - 2am": { uph: "", pickers: "" },
    "3am - 4am": { uph: "", pickers: "" },
    "4am - 5am": { uph: "", pickers: "" },
  },
});

const createEmptyShiftHistory = () => ({
  night: createEmptyZoneHistory(),
  day: createEmptyZoneHistory(),
});

export default function PickAndBaggedCombinedCard() {
  const [selectedShift, setSelectedShift] = useState("night");

  const [ambientPickers, setAmbientPickers] = useState("");
  const [chillPickers, setChillPickers] = useState("");
  const [ambientUPH, setAmbientUPH] = useState("");
  const [chillUPH, setChillUPH] = useState("");
  const [ambientOutstanding, setAmbientOutstanding] = useState("");
  const [chillOutstanding, setChillOutstanding] = useState("");
  const [ambientBreak1, setAmbientBreak1] = useState("");
  const [chillBreak1, setChillBreak1] = useState("");
  const [uphHistory, setUphHistory] = useState(createEmptyShiftHistory());
  const [toast, setToast] = useState({ show: false, message: "" });

  const showToast = (m) => {
    setToast({ show: true, message: m });
    setTimeout(() => setToast({ show: false, message: "" }), 1800);
  };

  useEffect(() => {
    const unsub = onSnapshot(PICK_DOC, (snap) => {
      if (!snap.exists()) return;
      const d = snap.data() || {};

      setAmbientPickers(d.ambientPickers || "");
      setChillPickers(d.chillPickers || "");
      setAmbientUPH(d.ambientUPH || "");
      setChillUPH(d.chillUPH || "");
      setAmbientOutstanding(d.ambientOutstanding || "");
      setChillOutstanding(d.chillOutstanding || "");
      setAmbientBreak1(d.ambientBreak1 || "");
      setChillBreak1(d.chillBreak1 || "");
      setSelectedShift(d.selectedShift || "night");

      const savedHistory = d.uphHistory || {};
      const nextHistory = createEmptyShiftHistory();

      const isLegacyShape =
        savedHistory &&
        !savedHistory.night &&
        !savedHistory.day &&
        typeof savedHistory === "object";

      if (isLegacyShape) {
        HISTORY_ZONES.forEach((zone) => {
          HISTORY_SLOTS.forEach((slot) => {
            nextHistory.night[zone][slot] = {
              uph: savedHistory?.[zone]?.[slot]?.uph || "",
              pickers: savedHistory?.[zone]?.[slot]?.pickers || "",
            };
          });
        });
      } else {
        SHIFT_OPTIONS.forEach((shift) => {
          HISTORY_ZONES.forEach((zone) => {
            HISTORY_SLOTS.forEach((slot) => {
              nextHistory[shift][zone][slot] = {
                uph: savedHistory?.[shift]?.[zone]?.[slot]?.uph || "",
                pickers: savedHistory?.[shift]?.[zone]?.[slot]?.pickers || "",
              };
            });
          });
        });
      }

      setUphHistory(nextHistory);
    });

    return () => unsub();
  }, []);

  const projected = (uph, pickers) => (parseFloat(uph) || 0) * (parseFloat(pickers) || 0);

  const finishingTime = (outstanding, proj, breakMinutes) => {
    if (!proj || proj <= 0) return "-";

    const now = new Date();
    const hoursNeeded = outstanding / proj;

    let finish = new Date(now.getTime() + hoursNeeded * 3600000);
    const extraMs = (parseFloat(breakMinutes) || 0) * 60000;
    finish = new Date(finish.getTime() + extraMs);

    let h = finish.getHours();
    let m = finish.getMinutes().toString().padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;

    return `${h}:${m} ${ampm}`;
  };

  const getAverageUPH = (shift, zone) => {
    const values = HISTORY_SLOTS
      .map((slot) => parseFloat(uphHistory?.[shift]?.[zone]?.[slot]?.uph))
      .filter((value) => Number.isFinite(value) && value > 0);

    if (!values.length) return "-";

    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    return Math.round(average).toString();
  };

  const getFilledUPHCount = (shift, zone) => {
    return HISTORY_SLOTS.filter((slot) => {
      const value = parseFloat(uphHistory?.[shift]?.[zone]?.[slot]?.uph);
      return Number.isFinite(value) && value > 0;
    }).length;
  };

  const saveSelectedShift = async (shift) => {
    setSelectedShift(shift);

    await setDoc(
      PICK_DOC,
      {
        selectedShift: shift,
      },
      { merge: true }
    );
  };

  const savePickCalc = async () => {
    await setDoc(
      PICK_DOC,
      {
        ambientPickers,
        chillPickers,
        ambientUPH,
        chillUPH,
        ambientOutstanding,
        chillOutstanding,
        ambientBreak1,
        chillBreak1,
      },
      { merge: true }
    );
    showToast("Pick Calculator Saved");
  };

  const clearPickCalc = async () => {
    setAmbientPickers("");
    setChillPickers("");
    setAmbientUPH("");
    setChillUPH("");
    setAmbientOutstanding("");
    setChillOutstanding("");
    setAmbientBreak1("");
    setChillBreak1("");

    await setDoc(
      PICK_DOC,
      {
        ambientPickers: "",
        chillPickers: "",
        ambientUPH: "",
        chillUPH: "",
        ambientOutstanding: "",
        chillOutstanding: "",
        ambientBreak1: "",
        chillBreak1: "",
      },
      { merge: true }
    );

    showToast("Pick Calculator Cleared");
  };

  const updateHistoryCell = (shift, zone, slot, field, value) => {
    setUphHistory((prev) => ({
      ...prev,
      [shift]: {
        ...prev[shift],
        [zone]: {
          ...prev[shift][zone],
          [slot]: {
            ...prev[shift][zone][slot],
            [field]: value,
          },
        },
      },
    }));
  };

  const saveUphHistory = async () => {
    await setDoc(
      PICK_DOC,
      {
        uphHistory,
      },
      { merge: true }
    );
    showToast("UPH History Saved");
  };

  const clearUphHistory = async () => {
    const emptyHistory = createEmptyShiftHistory();
    setUphHistory(emptyHistory);

    await setDoc(
      PICK_DOC,
      {
        uphHistory: emptyHistory,
      },
      { merge: true }
    );

    showToast("UPH History Cleared");
  };

  const ambProjected = projected(ambientUPH, ambientPickers);
  const chlProjected = projected(chillUPH, chillPickers);

  const ambFinish = finishingTime(
    parseFloat(ambientOutstanding) || 0,
    ambProjected,
    ambientBreak1
  );

  const chlFinish = finishingTime(
    parseFloat(chillOutstanding) || 0,
    chlProjected,
    chillBreak1
  );

  const ambientAvgUPH = getAverageUPH(selectedShift, "ambient");
  const chillAvgUPH = getAverageUPH(selectedShift, "chill");

  const ambientAvgCount = getFilledUPHCount(selectedShift, "ambient");
  const chillAvgCount = getFilledUPHCount(selectedShift, "chill");

  return (
    <section className="data-card pick-card" style={{ position: "relative" }}>
      <h2 className="data-title">Pick Calculator</h2>

      <div className="pick-subcards">
        <div className="shift-subcard pick-subcard pick-main-card">
          <h3>Main Pick Calculator</h3>

          <div className="table-container pick-table-wrap">
            <table className="data-table pick-table spaced-table">
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>Pickers</th>
                  <th>UPH</th>
                  <th>Outstanding</th>
                  <th>Break (min)</th>
                  <th>Projected Hourly Picks</th>
                  <th>Finishing At</th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td>Ambient</td>
                  <td>
                    <input
                      type="number"
                      value={ambientPickers}
                      onChange={(e) => setAmbientPickers(e.target.value)}
                      className="pick-input"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={ambientUPH}
                      onChange={(e) => setAmbientUPH(e.target.value)}
                      className="pick-input"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={ambientOutstanding}
                      onChange={(e) => setAmbientOutstanding(e.target.value)}
                      className="pick-input outstanding-input"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={ambientBreak1}
                      onChange={(e) => setAmbientBreak1(e.target.value)}
                      className="break-input"
                    />
                  </td>
                  <td>{ambProjected}</td>
                  <td>{ambFinish}</td>
                </tr>

                <tr>
                  <td>Chill</td>
                  <td>
                    <input
                      type="number"
                      value={chillPickers}
                      onChange={(e) => setChillPickers(e.target.value)}
                      className="pick-input"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={chillUPH}
                      onChange={(e) => setChillUPH(e.target.value)}
                      className="pick-input"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={chillOutstanding}
                      onChange={(e) => setChillOutstanding(e.target.value)}
                      className="pick-input outstanding-input"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={chillBreak1}
                      onChange={(e) => setChillBreak1(e.target.value)}
                      className="break-input"
                    />
                  </td>
                  <td>{chlProjected}</td>
                  <td>{chlFinish}</td>
                </tr>
              </tbody>
            </table>

            <div className="center-buttons">
              <button className="calculate-btn" onClick={savePickCalc}>
                Save
              </button>
              <button className="clear-btn" onClick={clearPickCalc}>
                Clear
              </button>
            </div>
          </div>
        </div>

        <div className="shift-subcard pick-subcard pick-avg-card">
          <h3>AVG UPH ({selectedShift === "night" ? "Night Shift" : "Day Shift"})</h3>

          <div className="avg-uph-grid">
            <div className="avg-uph-box">
              <div className="avg-uph-label">Ambient AVG UPH</div>
              <div className="avg-uph-value">{ambientAvgUPH}</div>
              <div className="avg-uph-meta">
                Based on {ambientAvgCount} filled UPH field{ambientAvgCount === 1 ? "" : "s"}
              </div>
            </div>

            <div className="avg-uph-box">
              <div className="avg-uph-label">Chill AVG UPH</div>
              <div className="avg-uph-value">{chillAvgUPH}</div>
              <div className="avg-uph-meta">
                Based on {chillAvgCount} filled UPH field{chillAvgCount === 1 ? "" : "s"}
              </div>
            </div>
          </div>
        </div>

        <div className="shift-subcard pick-subcard pick-history-card">
          <div className="pick-history-header">
            <h3>UPH History</h3>

            <div className="history-shift-toggle">
              <label className={`history-radio-option ${selectedShift === "night" ? "active" : ""}`}>
                <input
                  type="radio"
                  name="historyShift"
                  value="night"
                  checked={selectedShift === "night"}
                  onChange={() => saveSelectedShift("night")}
                />
                <span>Night Shift</span>
              </label>

              <label className={`history-radio-option ${selectedShift === "day" ? "active" : ""}`}>
                <input
                  type="radio"
                  name="historyShift"
                  value="day"
                  checked={selectedShift === "day"}
                  onChange={() => saveSelectedShift("day")}
                />
                <span>Day Shift</span>
              </label>
            </div>
          </div>

          {selectedShift === "day" ? (
            <div className="coming-soon-box">Coming soon</div>
          ) : (
            <div className="uph-history-horizontal">
              {HISTORY_SLOTS.map((slot) => (
                <div key={`${selectedShift}-${slot}`} className="uph-time-card">
                  <h4 className="uph-time-title">{slot}</h4>

                  <div className="uph-time-table">
                    <div className="uph-time-head">Zone</div>
                    <div className="uph-time-head">UPH</div>
                    <div className="uph-time-head">Pickers</div>

                    {HISTORY_ZONES.map((zone) => (
                      <React.Fragment key={`${slot}-${zone}`}>
                        <div className="uph-time-zone">
                          {zone.charAt(0).toUpperCase() + zone.slice(1)}
                        </div>

                        <div>
                          <input
                            type="number"
                            value={uphHistory?.[selectedShift]?.[zone]?.[slot]?.uph || ""}
                            onChange={(e) =>
                              updateHistoryCell(
                                selectedShift,
                                zone,
                                slot,
                                "uph",
                                e.target.value
                              )
                            }
                            className="pick-input compact-history-input"
                          />
                        </div>

                        <div>
                          <input
                            type="number"
                            value={uphHistory?.[selectedShift]?.[zone]?.[slot]?.pickers || ""}
                            onChange={(e) =>
                              updateHistoryCell(
                                selectedShift,
                                zone,
                                slot,
                                "pickers",
                                e.target.value
                              )
                            }
                            className="pick-input compact-history-input"
                          />
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="center-buttons">
            <button className="calculate-btn" onClick={saveUphHistory}>
              Save
            </button>
            <button className="clear-btn" onClick={clearUphHistory}>
              Clear
            </button>
          </div>
        </div>
      </div>

      {toast.show && <div className="toast-notification-center">{toast.message}</div>}
    </section>
  );
}