import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import "./App.css";

const PICK_DOC = doc(db, "totes", "pickCalculator");

export default function PickAndBaggedCombinedCard() {
  // --- Pick Calculator State ---
  const [ambientPickers, setAmbientPickers] = useState("");
  const [chillPickers, setChillPickers] = useState("");
  const [ambientUPH, setAmbientUPH] = useState("");
  const [chillUPH, setChillUPH] = useState("");
  const [ambientOutstanding, setAmbientOutstanding] = useState("");
  const [chillOutstanding, setChillOutstanding] = useState("");

  // --- Toast Notification ---
  const [toast, setToast] = useState({ show:false, message:"" });

  const showToast = (msg) => {
    setToast({ show:true, message:msg });
    setTimeout(() => setToast({ show:false, message:"" }), 2000);
  };

  // --- Load Firestore Data ---
  useEffect(() => {
    const unsub = onSnapshot(PICK_DOC, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setAmbientPickers(d.ambientPickers || "");
        setChillPickers(d.chillPickers || "");
        setAmbientUPH(d.ambientUPH || "");
        setChillUPH(d.chillUPH || "");
        setAmbientOutstanding(d.ambientOutstanding || "");
        setChillOutstanding(d.chillOutstanding || "");
      }
    });
    return () => unsub();
  }, []);

  // --- Helper Functions ---
  const projected = (uph, pickers) => (parseFloat(uph) || 0) * (parseFloat(pickers) || 0);

  const finishingTime = (outstanding, proj) => {
    if (!proj || proj <= 0) return "-";

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();

    const time225 = new Date(year, month, day, 2, 25, 0);
    const time310 = new Date(year, month, day, 3, 10, 0);

    const hoursNeeded = outstanding / proj;

    let finish;

    if (now < time225) {
      finish = new Date(now.getTime() + hoursNeeded * 3600000 + 45 * 60000);
    } else if (now > time310) {
      finish = new Date(now.getTime() + hoursNeeded * 3600000);
    } else {
      finish = new Date(time310.getTime() + hoursNeeded * 3600000);
    }

    let h = finish.getHours();
    let m = finish.getMinutes().toString().padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;

    return `${h}:${m} ${ampm}`;
  };

  // --- Save Pick Calculator ---
  const savePickCalc = async () => {
    await setDoc(PICK_DOC, {
      ambientPickers,
      chillPickers,
      ambientUPH,
      chillUPH,
      ambientOutstanding,
      chillOutstanding
    }, { merge:true });

    showToast("Pick Calculator Saved");
  };

  // --- Clear Pick Calculator ---
  const clearPickCalc = async () => {
    setAmbientPickers("");
    setChillPickers("");
    setAmbientUPH("");
    setChillUPH("");
    setAmbientOutstanding("");
    setChillOutstanding("");

    await setDoc(PICK_DOC, {
      ambientPickers: "",
      chillPickers: "",
      ambientUPH: "",
      chillUPH: "",
      ambientOutstanding: "",
      chillOutstanding: ""
    }, { merge:true });
  };

  // --- Calculated Values ---
  const ambProjected = projected(ambientUPH, ambientPickers);
  const chlProjected = projected(chillUPH, chillPickers);

  const ambFinish = finishingTime(parseFloat(ambientOutstanding) || 0, ambProjected);
  const chlFinish = finishingTime(parseFloat(chillOutstanding) || 0, chlProjected);

  return (
    <section className="data-card pick-card" style={{ position: "relative" }}>
      <h2 className="data-title">Pick Calculator</h2>

      <div className="table-container" style={{ marginTop: 24 }}>
        <table className="data-table pick-table">
          <thead>
            <tr>
              <th>Zone</th>
              <th>Pickers</th>
              <th>UPH</th>
              <th>Outstanding</th>
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
                  className="picker-input"
                />
              </td>
              <td>
                <input
                  type="number"
                  value={ambientUPH}
                  onChange={(e) => setAmbientUPH(e.target.value)}
                  className="uph-input"
                />
              </td>
              <td>
                <input
                  type="number"
                  value={ambientOutstanding}
                  onChange={(e) => setAmbientOutstanding(e.target.value)}
                  className="outstanding-input"
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
                  className="picker-input"
                />
              </td>
              <td>
                <input
                  type="number"
                  value={chillUPH}
                  onChange={(e) => setChillUPH(e.target.value)}
                  className="uph-input"
                />
              </td>
              <td>
                <input
                  type="number"
                  value={chillOutstanding}
                  onChange={(e) => setChillOutstanding(e.target.value)}
                  className="outstanding-input"
                />
              </td>
              <td>{chlProjected}</td>
              <td>{chlFinish}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <button className="calculate-btn" onClick={savePickCalc}>
            Save Pick Calculator
          </button>
          <button className="clear-btn" onClick={clearPickCalc}>
            Clear Pick Calculator
          </button>
        </div>
      </div>

      {toast.show && (
        <div className="toast-notification-center">{toast.message}</div>
      )}
    </section>
  );
}
