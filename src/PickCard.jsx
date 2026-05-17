import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import "./App.css";
import "./pick.css";

const PICK_DOC = doc(db, "totes", "pickCalculator");

const HISTORY_SLOTS = ["12am - 1am", "1am - 2am", "3am - 4am"];
const HISTORY_ZONES = ["ambient", "chill", "freezer"];

const createEmptyHistory = () => ({
  ambient: {
    "12am - 1am": { uph: "", pickers: "" },
    "1am - 2am": { uph: "", pickers: "" },
    "3am - 4am": { uph: "", pickers: "" },
  },
  chill: {
    "12am - 1am": { uph: "", pickers: "" },
    "1am - 2am": { uph: "", pickers: "" },
    "3am - 4am": { uph: "", pickers: "" },
  },
  freezer: {
    "12am - 1am": { uph: "", pickers: "" },
    "1am - 2am": { uph: "", pickers: "" },
    "3am - 4am": { uph: "", pickers: "" },
  },
});

export default function PickAndBaggedCombinedCard() {
  const [ambientPickers, setAmbientPickers] = useState("");
  const [chillPickers, setChillPickers] = useState("");
  const [ambientUPH, setAmbientUPH] = useState("");
  const [chillUPH, setChillUPH] = useState("");
  const [ambientOutstanding, setAmbientOutstanding] = useState("");
  const [chillOutstanding, setChillOutstanding] = useState("");

  const [ambientBreak1, setAmbientBreak1] = useState("");
  const [chillBreak1, setChillBreak1] = useState("");

  const [uphHistory, setUphHistory] = useState(createEmptyHistory());

  const [toast, setToast] = useState({ show: false, message: "" });
  const showToast = (m) => {
    setToast({ show: true, message: m });
    setTimeout(() => setToast({ show: false, message: "" }), 1800);
  };

  useEffect(() => {
    const unsub = onSnapshot(PICK_DOC, (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();

      setAmbientPickers(d.ambientPickers || "");
      setChillPickers(d.chillPickers || "");
      setAmbientUPH(d.ambientUPH || "");
      setChillUPH(d.chillUPH || "");
      setAmbientOutstanding(d.ambientOutstanding || "");
      setChillOutstanding(d.chillOutstanding || "");

      setAmbientBreak1(d.ambientBreak1 || "");
      setChillBreak1(d.chillBreak1 || "");

      const savedHistory = d.uphHistory || {};
      const nextHistory = createEmptyHistory();

      HISTORY_ZONES.forEach((zone) => {
        HISTORY_SLOTS.forEach((slot) => {
          nextHistory[zone][slot] = {
            uph: savedHistory?.[zone]?.[slot]?.uph || "",
            pickers: savedHistory?.[zone]?.[slot]?.pickers || "",
          };
        });
      });

      setUphHistory(nextHistory);
    });

    return () => unsub();
  }, []);

  const projected = (uph, pickers) =>
    (parseFloat(uph) || 0) * (parseFloat(pickers) || 0);

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
  };

  const updateHistoryCell = (zone, slot, field, value) => {
    setUphHistory((prev) => ({
      ...prev,
      [zone]: {
        ...prev[zone],
        [slot]: {
          ...prev[zone][slot],
          [field]: value,
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
    const emptyHistory = createEmptyHistory();
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

  return (
    <section className="data-card pick-card" style={{ position: "relative" }}>
      <h2 className="data-title">Pick Calculator</h2>

      <div className="pick-subcards">
        <div className="shift-subcard pick-subcard">
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

        <div className="shift-subcard pick-subcard">
          <h3>UPH History</h3>

          <div className="uph-history-grid">
            {HISTORY_ZONES.map((zone) => (
              <div key={zone} className="uph-zone-card">
                <h4 className="uph-zone-title">
                  {zone.charAt(0).toUpperCase() + zone.slice(1)}
                </h4>

                <div className="uph-zone-rows">
                  {HISTORY_SLOTS.map((slot) => (
                    <div key={`${zone}-${slot}`} className="uph-history-row">
                      <div className="uph-slot">{slot}</div>

                      <div className="uph-history-fields">
                        <div className="uph-history-field">
                          <label>UPH</label>
                          <input
                            type="number"
                            value={uphHistory[zone][slot].uph}
                            onChange={(e) =>
                              updateHistoryCell(zone, slot, "uph", e.target.value)
                            }
                            className="pick-input"
                          />
                        </div>

                        <div className="uph-history-field">
                          <label>Pickers</label>
                          <input
                            type="number"
                            value={uphHistory[zone][slot].pickers}
                            onChange={(e) =>
                              updateHistoryCell(zone, slot, "pickers", e.target.value)
                            }
                            className="pick-input"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

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